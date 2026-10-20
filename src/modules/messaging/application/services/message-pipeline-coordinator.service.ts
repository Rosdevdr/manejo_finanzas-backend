// ==============================================================================
// 🏛️ AUREUS · APPLICATION SERVICE: MESSAGE PIPELINE COORDINATOR (PIPELINE E2E)
// ==============================================================================

import type { IInboxRepository } from '../../domain/ports/inbox-repository.port.js'
import type { IIdentityRepository } from '../../domain/ports/identity-repository.port.js'
import type { IOutboxRepository } from '../../domain/ports/outbox-repository.port.js'
import type { ExtractInboxExpenseUseCase } from '../../../ledger/application/use-cases/extract-inbox-expense.use-case.js'
import type { ProcessExtractedMessageUseCase } from '../../../ledger/application/use-cases/process-extracted-message.use-case.js'
import type { OutboxDispatcherWorker } from '../workers/outbox-dispatcher.worker.js'
import { OutboxMessage } from '../../domain/entities/outbox-message.entity.js'
import type { SupportedCurrency } from '../../../../shared/domain/value-objects/money.vo.js'

export interface PipelineExecutionResult {
  inboxEventId: string
  stage2Status: 'extracted' | 'needs_review' | 'failed' | 'already_processed'
  stage3Executed: boolean
  entriesCount: number
  outboxDispatched: number
}

export class MessagePipelineCoordinator {
  constructor(
    private readonly inboxRepo: IInboxRepository,
    private readonly identityRepo: IIdentityRepository,
    private readonly outboxRepo: IOutboxRepository,
    private readonly extractUseCase: ExtractInboxExpenseUseCase,
    private readonly processExtractedUseCase: ProcessExtractedMessageUseCase,
    private readonly outboxWorker: OutboxDispatcherWorker
  ) {}

  /**
   * Coordina la ejecución secuencial desacoplada de las 4 etapas del pipeline:
   * Etapa 1 ya ocurrió (InboxEvent guardado como 'received').
   * Etapa 2: Extracción con IA (sin bloqueos de BD).
   * Etapa 3: Transacción atómica ACID (Ledger + Outbox + Processed).
   * Etapa 4: Despacho a Telegram con reintentos at-least-once.
   */
  public async processEvent(inboxEventId: string): Promise<PipelineExecutionResult> {
    const event = await this.inboxRepo.findById(inboxEventId)
    if (!event) {
      throw new Error(`Evento ${inboxEventId} no encontrado`)
    }

    // 1. Resolver o auto-aprovisionar identidad del usuario y hogar
    const identity = await this.identityRepo.findOrCreateUserForChannel(
      event.getProvider(),
      event.getSenderId()
    )

    // 2. Etapa 2: Extracción con IA (Gemini)
    const extraction = await this.extractUseCase.execute({
      inboxEventId,
      householdCurrency: identity.currency,
    })

    let stage3Executed = false
    let entriesCount = 0

    if (extraction.status === 'extracted') {
      // 3. Etapa 3: Transacción Atómica ACID en el Ledger
      const processResult = await this.processExtractedUseCase.execute({
        inboxEventId,
        householdId: identity.householdId,
        userId: identity.userId,
        currency: identity.currency as SupportedCurrency,
      })

      stage3Executed = processResult.success
      entriesCount = processResult.entriesCount
    } else if (extraction.status === 'needs_review' && extraction.clarificationQuestion) {
      // Si fue ambiguo, encolamos la pregunta de clarificación en outbox
      const questionMessage = OutboxMessage.create({
        sourceEventId: event.getId(),
        provider: event.getProvider(),
        recipientId: event.getExternalChatId(),
        payload: {
          text: `🤔 ${extraction.clarificationQuestion}`,
        },
      })
      await this.outboxRepo.enqueue(questionMessage)
    }

    // 4. Etapa 4: Despacho de mensajes pendientes en outbox
    const dispatchResult = await this.outboxWorker.dispatchPendingBatch(5)

    return {
      inboxEventId,
      stage2Status: extraction.status,
      stage3Executed,
      entriesCount,
      outboxDispatched: dispatchResult.sentCount,
    }
  }
}
