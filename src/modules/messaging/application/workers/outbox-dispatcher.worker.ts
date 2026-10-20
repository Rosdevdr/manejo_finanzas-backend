// ==============================================================================
// 🏛️ AUREUS · APPLICATION WORKER: OUTBOX DISPATCHER (ETAPA 4 DESPACHO CON RETRY)
// ==============================================================================

import type { IOutboxRepository } from '../../domain/ports/outbox-repository.port.js'
import type { IMessengerService } from '../../domain/ports/messenger-service.port.js'

export interface DispatchBatchResult {
  claimedCount: number
  sentCount: number
  failedCount: number
}

export class OutboxDispatcherWorker {
  constructor(
    private readonly outboxRepo: IOutboxRepository,
    private readonly messengerService: IMessengerService
  ) {}

  /**
   * Reclama un lote de mensajes pendientes o reintentables de la base de datos
   * mediante `SELECT FOR UPDATE SKIP LOCKED` y los entrega a sus destinatarios.
   */
  public async dispatchPendingBatch(
    batchSize: number = 10,
    leaseSeconds: number = 30
  ): Promise<DispatchBatchResult> {
    const messages = await this.outboxRepo.claimPendingBatch(batchSize, leaseSeconds)

    if (messages.length === 0) {
      return {
        claimedCount: 0,
        sentCount: 0,
        failedCount: 0,
      }
    }

    let sentCount = 0
    let failedCount = 0

    for (const message of messages) {
      const payload = message.getPayload()
      const text = typeof payload.text === 'string' ? payload.text : ''

      if (!text) {
        message.markFailed('Payload no contiene texto para enviar')
        await this.outboxRepo.update(message)
        failedCount++
        continue
      }

      try {
        const result = await this.messengerService.sendMessage(
          message.getProvider(),
          message.getRecipientId(),
          text
        )

        if (result.success) {
          message.markSent()
          await this.outboxRepo.update(message)
          sentCount++
        } else {
          message.markFailed(result.error || 'Fallo no especificado al enviar mensaje')
          await this.outboxRepo.update(message)
          failedCount++
        }
      } catch (err: unknown) {
        const errorMsg = (err as Error).message || 'Error de red inesperado durante envío'
        message.markFailed(errorMsg)
        await this.outboxRepo.update(message)
        failedCount++
      }
    }

    return {
      claimedCount: messages.length,
      sentCount,
      failedCount,
    }
  }
}
