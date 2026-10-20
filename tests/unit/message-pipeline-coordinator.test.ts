import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessagePipelineCoordinator } from '../../src/modules/messaging/application/services/message-pipeline-coordinator.service.js'
import { InboxEvent } from '../../src/modules/messaging/domain/entities/inbox-event.entity.js'
import type { IInboxRepository } from '../../src/modules/messaging/domain/ports/inbox-repository.port.js'
import type { IIdentityRepository } from '../../src/modules/messaging/domain/ports/identity-repository.port.js'
import type { IOutboxRepository } from '../../src/modules/messaging/domain/ports/outbox-repository.port.js'
import type { ExtractInboxExpenseUseCase } from '../../src/modules/ledger/application/use-cases/extract-inbox-expense.use-case.js'
import type { ProcessExtractedMessageUseCase } from '../../src/modules/ledger/application/use-cases/process-extracted-message.use-case.js'
import type { OutboxDispatcherWorker } from '../../src/modules/messaging/application/workers/outbox-dispatcher.worker.js'

describe('MessagePipelineCoordinator (Pipeline E2E Orquestador)', () => {
  let mockInboxRepo: IInboxRepository
  let mockIdentityRepo: IIdentityRepository
  let mockOutboxRepo: IOutboxRepository
  let mockExtractUseCase: ExtractInboxExpenseUseCase
  let mockProcessExtractedUseCase: ProcessExtractedMessageUseCase
  let mockOutboxWorker: OutboxDispatcherWorker
  let coordinator: MessagePipelineCoordinator

  const sampleEvent = InboxEvent.reconstitute({
    id: 'event-uuid-123',
    provider: 'telegram',
    externalUpdateId: 'up-1',
    externalChatId: 'chat-999',
    externalMessageId: 'msg-42',
    senderId: 'user-sender-1',
    messageType: 'text',
    rawPayload: { message: { text: '1200 gasolina' } },
    status: 'received',
    errorMessage: null,
    extractedData: null,
    aiModel: null,
    promptVersion: null,
    confidenceScore: null,
    createdAt: new Date(),
    processedAt: null,
  })

  beforeEach(() => {
    mockInboxRepo = {
      findById: vi.fn().mockResolvedValue(sampleEvent),
      saveRawEvent: vi.fn(),
      update: vi.fn(),
      findByExternalMessage: vi.fn(),
      claimForProcessing: vi.fn(),
    }

    mockIdentityRepo = {
      findUserByChannel: vi.fn(),
      findOrCreateUserForChannel: vi.fn().mockResolvedValue({
        userId: 'user-uuid-1',
        householdId: 'household-uuid-1',
        fullName: 'Juan',
        currency: 'DOP',
      }),
    }

    mockOutboxRepo = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      claimPendingBatch: vi.fn(),
      update: vi.fn(),
      findById: vi.fn(),
    }

    mockExtractUseCase = {
      execute: vi.fn().mockResolvedValue({
        status: 'extracted',
        items: [{ amount: '1200', description: 'Gasolina', category: 'transport', kind: 'expense' }],
        confidenceScore: 0.95,
        model: 'gemini-flash',
      }),
    } as any

    mockProcessExtractedUseCase = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        entriesCount: 1,
        totalFormatted: 'DOP $1,200.00',
      }),
    } as any

    mockOutboxWorker = {
      dispatchPendingBatch: vi.fn().mockResolvedValue({
        claimedCount: 1,
        sentCount: 1,
        failedCount: 0,
      }),
    } as any

    coordinator = new MessagePipelineCoordinator(
      mockInboxRepo,
      mockIdentityRepo,
      mockOutboxRepo,
      mockExtractUseCase,
      mockProcessExtractedUseCase,
      mockOutboxWorker
    )
  })

  it('ejecuta exitosamente las 4 etapas para un mensaje válido', async () => {
    const result = await coordinator.processEvent('event-uuid-123')

    expect(result).toEqual({
      inboxEventId: 'event-uuid-123',
      stage2Status: 'extracted',
      stage3Executed: true,
      entriesCount: 1,
      outboxDispatched: 1,
    })

    expect(mockIdentityRepo.findOrCreateUserForChannel).toHaveBeenCalledWith('telegram', 'user-sender-1')
    expect(mockExtractUseCase.execute).toHaveBeenCalledWith({
      inboxEventId: 'event-uuid-123',
      householdCurrency: 'DOP',
    })
    expect(mockProcessExtractedUseCase.execute).toHaveBeenCalledWith({
      inboxEventId: 'event-uuid-123',
      householdId: 'household-uuid-1',
      userId: 'user-uuid-1',
      currency: 'DOP',
    })
    expect(mockOutboxWorker.dispatchPendingBatch).toHaveBeenCalledWith(5)
  })

  it('si el mensaje es ambiguo (needs_review), encola pregunta de clarificación y la despacha', async () => {
    vi.mocked(mockExtractUseCase.execute).mockResolvedValueOnce({
      status: 'needs_review',
      clarificationQuestion: '¿Cuánto pagaste por el servicio?',
    })

    const result = await coordinator.processEvent('event-uuid-123')

    expect(result.stage2Status).toBe('needs_review')
    expect(result.stage3Executed).toBe(false)
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'chat-999',
      })
    )
    expect(mockOutboxWorker.dispatchPendingBatch).toHaveBeenCalled()
  })
})
