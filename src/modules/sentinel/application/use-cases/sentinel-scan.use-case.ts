// ==============================================================================
// 🛡️ AUREUS · APPLICATION USE CASE: ESCANEO CENTINELA ANTI-MORAS
// ==============================================================================

import type { ISentinelRepository } from '../../domain/ports/sentinel-repository.port.js'
import type { IIdentityRepository } from '../../../messaging/domain/ports/identity-repository.port.js'
import type { IOutboxRepository } from '../../../messaging/domain/ports/outbox-repository.port.js'
import { OutboxMessage } from '../../../messaging/domain/entities/outbox-message.entity.js'

export interface SentinelScanCommand {
  asOfDate?: Date
  horizonDays?: number
}

export interface SentinelScanResult {
  scannedCount: number
  alertsGeneratedCount: number
}

export class SentinelScanUseCase {
  constructor(
    private readonly sentinelRepo: ISentinelRepository,
    private readonly identityRepo: IIdentityRepository,
    private readonly outboxRepo: IOutboxRepository
  ) {}

  public async execute(command: SentinelScanCommand = {}): Promise<SentinelScanResult> {
    const asOfDate = command.asOfDate || new Date()
    const horizonDays = command.horizonDays ?? 7

    const pendingItems = await this.sentinelRepo.listPendingCyclesForScan(asOfDate, horizonDays)

    let alertsGeneratedCount = 0

    for (const { commitment, cycle } of pendingItems) {
      // 1. Actualizar estado si ya venció
      cycle.checkOverdue(asOfDate)

      // 2. Verificar si corresponde alertar hoy
      const { alert, daysRemaining } = commitment.shouldAlertToday(asOfDate, cycle.getDueDate())
      const isOverdue = cycle.getStatus() === 'overdue'

      if (!alert && !isOverdue) {
        continue
      }

      // 3. Evitar duplicar alertas el mismo día calendario (Idempotencia diaria)
      const lastAlert = cycle.getLastAlertAt()
      if (lastAlert) {
        const lastAlertDateStr = lastAlert.toISOString().split('T')[0]
        const todayDateStr = asOfDate.toISOString().split('T')[0]
        if (lastAlertDateStr === todayDateStr) {
          continue
        }
      }

      // 4. Buscar canal de mensajería del hogar (Telegram/WhatsApp)
      const channel = await this.identityRepo.findPrimaryChannelForHousehold(
        commitment.getHouseholdId()
      )
      if (!channel) {
        continue
      }

      // 5. Redactar mensaje centinela
      const alertText = this.buildAlertMessage(commitment.getName(), daysRemaining, {
        expectedAmount: commitment.getExpectedAmount()?.format(),
        estimatedLateFee: commitment.getEstimatedLateFee().format(),
        dueDateStr: cycle.getDueDate().toISOString().split('T')[0],
      })

      // 6. Encolar en Outbox para entrega confiable at-least-once
      const outboxMsg = OutboxMessage.create({
        provider: channel.provider,
        recipientId: channel.recipientId,
        payload: { text: alertText },
      })
      await this.outboxRepo.enqueue(outboxMsg)

      // 7. Registrar alerta en el ciclo y persistir
      cycle.recordAlertSent(asOfDate)
      await this.sentinelRepo.updateCycle(cycle)

      alertsGeneratedCount++
    }

    return {
      scannedCount: pendingItems.length,
      alertsGeneratedCount,
    }
  }

  private buildAlertMessage(
    name: string,
    daysRemaining: number,
    data: { expectedAmount?: string; estimatedLateFee: string; dueDateStr: string }
  ): string {
    const amountPart = data.expectedAmount ? `Monto estimado: <b>${data.expectedAmount}</b>\n` : ''

    if (daysRemaining > 0) {
      return (
        `🛡️ <b>Centinela AUREUS: Recordatorio Preventivo</b>\n\n` +
        `Tu compromiso <b>${name}</b> vence en <b>${daysRemaining} días</b> (${data.dueDateStr}).\n` +
        `${amountPart}` +
        `💡 <i>¡Paga a tiempo y evita un recargo estimado de ${data.estimatedLateFee} en moras!</i>`
      )
    }

    if (daysRemaining === 0) {
      return (
        `⚠️ <b>Centinela AUREUS: ¡Vence Hoy!</b>\n\n` +
        `Tu compromiso <b>${name}</b> vence <b>HOY</b> (${data.dueDateStr}).\n` +
        `${amountPart}` +
        `🚨 <i>Evita el cargo por mora de ${data.estimatedLateFee} pagando antes del cierre bancario.</i>`
      )
    }

    return (
      `🚨 <b>Centinela AUREUS: Compromiso Vencido</b>\n\n` +
      `Tu compromiso <b>${name}</b> venció hace ${Math.abs(daysRemaining)} días.\n` +
      `${amountPart}` +
      `⚠️ <i>Regulariza tu pago para evitar mayores recargos o suspensión del servicio.</i>`
    )
  }
}
