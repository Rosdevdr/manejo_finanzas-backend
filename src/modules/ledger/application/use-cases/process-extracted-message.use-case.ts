// ==============================================================================
// 🏛️ AUREUS · APPLICATION USE CASE: PROCESAR MENSAJE EXTRAÍDO (ETAPA 3 ACID)
// ==============================================================================

import type { IInboxRepository } from '../../../messaging/domain/ports/inbox-repository.port.js'
import type { ILedgerRepository } from '../../domain/ports/ledger-repository.port.js'
import type { IOutboxRepository } from '../../../messaging/domain/ports/outbox-repository.port.js'
import type { IUnitOfWork } from '../../../../shared/application/ports/unit-of-work.port.js'
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity.js'
import { OutboxMessage } from '../../../messaging/domain/entities/outbox-message.entity.js'
import { Money, type SupportedCurrency } from '../../../../shared/domain/value-objects/money.vo.js'
import { DomainError } from '../../../../shared/domain/errors/domain.error.js'

export class InboxEventNotFoundError extends DomainError {
  constructor(id: string) {
    super(`No se encontró el evento de inbox con ID: ${id}`)
  }
}

export class InvalidExtractedDataError extends DomainError {
  constructor(message: string) {
    super(`[ExtractedData] ${message}`)
  }
}

export interface ExtractedItemDTO {
  amount: string | number
  description: string
  category?: string
  kind?: 'expense' | 'income'
}

export interface ProcessExtractedMessageCommand {
  inboxEventId: string
  householdId: string
  userId: string
  currency?: SupportedCurrency
}

export interface ProcessExtractedMessageResult {
  success: boolean
  alreadyProcessed?: boolean
  entriesCount: number
  totalFormatted: string
}

export class ProcessExtractedMessageUseCase {
  constructor(
    private readonly inboxRepo: IInboxRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly outboxRepo: IOutboxRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  public async execute(command: ProcessExtractedMessageCommand): Promise<ProcessExtractedMessageResult> {
    const { inboxEventId, householdId, userId } = command
    const defaultCurrency = command.currency || 'DOP'

    // 1. Obtener y validar el evento de inbox
    const event = await this.inboxRepo.findById(inboxEventId)
    if (!event) {
      throw new InboxEventNotFoundError(inboxEventId)
    }

    const currentStatus = event.getStatus()
    if (currentStatus !== 'extracted' && currentStatus !== 'needs_review') {
      throw new InvalidExtractedDataError(
        `El evento no se encuentra en estado extraído. Estado actual: "${currentStatus}"`
      )
    }

    // 2. Parsear y validar los ítems extraídos por la IA
    const rawData = event.getExtractedData()
    const items = this.parseExtractedItems(rawData)

    if (items.length === 0) {
      throw new InvalidExtractedDataError('El evento extraído no contiene partidas financieras válidas')
    }

    // 3. Ejecución Atómica ACID (Etapa 3)
    return await this.unitOfWork.execute(async () => {
      // 3.1 Guardia de concurrencia: Reclamar el evento atómicamente
      const claimed = await this.inboxRepo.claimForProcessing(inboxEventId)
      if (!claimed) {
        // Otro worker paralelo ya reclamó o procesó este evento
        return {
          success: false,
          alreadyProcessed: true,
          entriesCount: 0,
          totalFormatted: 'DOP $0.00',
        }
      }

      // 3.2 Construir las entidades LedgerEntry con sourceLine secuencial
      const ledgerEntries: LedgerEntry[] = []
      let runningTotal = Money.zero(defaultCurrency)

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const sourceLine = i + 1
        const amount = Money.parse(item.amount, defaultCurrency)
        runningTotal = runningTotal.add(amount)

        const entry =
          item.kind === 'income'
            ? LedgerEntry.createIncome({
                householdId,
                userId,
                sourceEventId: event.getId(),
                sourceLine,
                amount,
                description: item.description,
              })
            : LedgerEntry.createExpense({
                householdId,
                userId,
                sourceEventId: event.getId(),
                sourceLine,
                amount,
                description: item.description,
              })

        ledgerEntries.push(entry)
      }

      // 3.3 Persistir el lote en el Ledger inmutable
      await this.ledgerRepo.appendBatch(ledgerEntries)

      // 3.4 Generar el mensaje de confirmación para el usuario
      const replyText = this.buildReplyText(ledgerEntries, runningTotal)

      // 3.5 Encolar en Outbox para despacho confiable (at-least-once)
      const outboxMsg = OutboxMessage.create({
        sourceEventId: event.getId(),
        provider: event.getProvider(),
        recipientId: event.getExternalChatId(),
        payload: { text: replyText },
      })

      await this.outboxRepo.enqueue(outboxMsg)

      return {
        success: true,
        alreadyProcessed: false,
        entriesCount: ledgerEntries.length,
        totalFormatted: runningTotal.toFormattedString(),
      }
    })
  }

  private parseExtractedItems(rawData: Record<string, unknown> | null): ExtractedItemDTO[] {
    if (!rawData) return []

    // Soporte tanto para formato { items: [...] } como para array directo
    const candidateList = Array.isArray(rawData.items)
      ? rawData.items
      : Array.isArray(rawData)
      ? rawData
      : []

    const validItems: ExtractedItemDTO[] = []

    for (const rawItem of candidateList) {
      if (typeof rawItem === 'object' && rawItem !== null) {
        const item = rawItem as Record<string, unknown>
        if (item.amount !== undefined && item.description) {
          validItems.push({
            amount: String(item.amount),
            description: String(item.description).trim(),
            category: item.category ? String(item.category) : undefined,
            kind: item.kind === 'income' ? 'income' : 'expense',
          })
        }
      }
    }

    return validItems
  }

  private buildReplyText(entries: LedgerEntry[], total: Money): string {
    const lines = entries.map(e => `• ${e.getDescription()}: ${e.getAmount().toFormattedString()}`)

    if (entries.length === 1) {
      return `✅ Registrado en el hogar:\n${lines[0]}`
    }

    return `✅ Registrado en el hogar:\n${lines.join('\n')}\n─────────────────\nTotal: ${total.toFormattedString()}`
  }
}
