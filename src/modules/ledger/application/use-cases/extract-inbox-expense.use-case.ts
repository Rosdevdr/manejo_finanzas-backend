// ==============================================================================
// 🏛️ AUREUS · APPLICATION USE CASE: EXTRAER GASTO DE INBOX CON IA (ETAPA 2)
// ==============================================================================

import type { IInboxRepository } from '../../../messaging/domain/ports/inbox-repository.port.js'
import type { IExpenseExtractor, ExtractedItem } from '../../domain/ports/expense-extractor.port.js'
import { DomainError } from '../../../../shared/domain/errors/domain.error.js'

export class InboxEventNotFoundError extends DomainError {
  constructor(id: string) {
    super(`No se encontró el evento de inbox con ID: ${id}`)
  }
}

export interface ExtractInboxExpenseCommand {
  inboxEventId: string
  householdCurrency?: string
}

export interface ExtractInboxExpenseResult {
  status: 'extracted' | 'needs_review' | 'failed' | 'already_processed'
  items?: ExtractedItem[]
  clarificationQuestion?: string
  confidenceScore?: number
  model?: string
}

export class ExtractInboxExpenseUseCase {
  constructor(
    private readonly inboxRepo: IInboxRepository,
    private readonly extractor: IExpenseExtractor
  ) {}

  public async execute(command: ExtractInboxExpenseCommand): Promise<ExtractInboxExpenseResult> {
    const { inboxEventId, householdCurrency = 'DOP' } = command

    // 1. Obtener el evento de inbox
    const event = await this.inboxRepo.findById(inboxEventId)
    if (!event) {
      throw new InboxEventNotFoundError(inboxEventId)
    }

    // Si ya fue extraído o procesado, evitamos llamadas redundantes a Gemini (Idempotencia)
    const currentStatus = event.getStatus()
    if (currentStatus === 'extracted' || currentStatus === 'processed') {
      const data = event.getExtractedData()
      return {
        status: 'already_processed',
        items: (data?.items as ExtractedItem[]) || [],
        confidenceScore: event.getConfidenceScore() ?? undefined,
        model: event.getAiModel() ?? undefined,
      }
    }

    // 2. Extraer texto crudo del payload
    const rawPayload = event.getRawPayload() as Record<string, any>
    const message = rawPayload?.message
    const textToProcess: string | undefined = message?.text || message?.caption

    if (!textToProcess) {
      // Si es audio o imagen sin texto, marcamos needs_review para transcripción/OCR
      event.markNeedsReview('Mensaje sin texto legible disponible para extracción directa')
      await this.inboxRepo.update(event)
      return {
        status: 'needs_review',
        clarificationQuestion: '¿Podrías escribir el detalle de tu gasto?',
      }
    }

    // 3. Ejecutar extracción con IA (Gemini) fuera de transacciones de base de datos
    try {
      const result = await this.extractor.extractFromText(textToProcess, {
        householdCurrency,
        referenceDate: event.getCreatedAt(),
      })

      // 4. Manejo de ambigüedad
      if (result.isAmbiguous || result.items.length === 0) {
        event.markNeedsReview(
          result.clarificationQuestion || 'No se identificaron partidas financieras claras',
          {
            rawResponse: result.rawResponse,
            clarificationQuestion: result.clarificationQuestion,
          }
        )
        await this.inboxRepo.update(event)

        return {
          status: 'needs_review',
          clarificationQuestion: result.clarificationQuestion,
          confidenceScore: result.confidenceScore,
          model: result.model,
        }
      }

      // 5. Marcado exitoso como 'extracted'
      event.markExtracted({
        extractedData: { items: result.items },
        aiModel: result.model,
        promptVersion: result.promptVersion,
        confidenceScore: result.confidenceScore,
      })

      await this.inboxRepo.update(event)

      return {
        status: 'extracted',
        items: result.items,
        confidenceScore: result.confidenceScore,
        model: result.model,
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Error desconocido durante extracción de IA'
      event.markFailed(errorMsg)
      await this.inboxRepo.update(event)

      return {
        status: 'failed',
      }
    }
  }
}
