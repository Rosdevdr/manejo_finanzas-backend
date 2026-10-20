import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OutboxDispatcherWorker } from '../../src/modules/messaging/application/workers/outbox-dispatcher.worker.js'
import type { IOutboxRepository } from '../../src/modules/messaging/domain/ports/outbox-repository.port.js'
import type { IMessengerService } from '../../src/modules/messaging/domain/ports/messenger-service.port.js'
import { OutboxMessage } from '../../src/modules/messaging/domain/entities/outbox-message.entity.js'

describe('OutboxDispatcherWorker (Etapa 4 Worker de Despacho At-Least-Once)', () => {
  let mockOutboxRepo: IOutboxRepository
  let mockMessengerService: IMessengerService
  let worker: OutboxDispatcherWorker

  const createSampleMessage = (id: string, text = 'Hola Aureus', retryCount = 0) => {
    return OutboxMessage.reconstitute({
      id,
      sourceEventId: 'event-1',
      provider: 'telegram',
      recipientId: 'chat-999',
      messageType: 'text',
      payload: { text },
      status: 'processing',
      retryCount,
      maxRetries: 3,
      lockedUntil: new Date(Date.now() + 60000),
      nextAttemptAt: new Date(),
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    })
  }

  beforeEach(() => {
    mockOutboxRepo = {
      enqueue: vi.fn(),
      claimPendingBatch: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
    }

    mockMessengerService = {
      sendMessage: vi.fn(),
    }

    worker = new OutboxDispatcherWorker(mockOutboxRepo, mockMessengerService)
  })

  it('retorna ceros si no hay mensajes en la cola pendientes', async () => {
    vi.mocked(mockOutboxRepo.claimPendingBatch).mockResolvedValue([])

    const result = await worker.dispatchPendingBatch(5)

    expect(result).toEqual({ claimedCount: 0, sentCount: 0, failedCount: 0 })
    expect(mockMessengerService.sendMessage).not.toHaveBeenCalled()
  })

  it('despacha exitosamente los mensajes y los marca como sent', async () => {
    const msg1 = createSampleMessage('msg-1', 'Gasto 1')
    const msg2 = createSampleMessage('msg-2', 'Gasto 2')

    vi.mocked(mockOutboxRepo.claimPendingBatch).mockResolvedValue([msg1, msg2])
    vi.mocked(mockMessengerService.sendMessage).mockResolvedValue({
      success: true,
      externalMessageId: 'tg-123',
    })

    const result = await worker.dispatchPendingBatch(10)

    expect(result.claimedCount).toBe(2)
    expect(result.sentCount).toBe(2)
    expect(result.failedCount).toBe(0)

    expect(msg1.getStatus()).toBe('sent')
    expect(msg2.getStatus()).toBe('sent')
    expect(mockOutboxRepo.update).toHaveBeenCalledWith(msg1)
    expect(mockOutboxRepo.update).toHaveBeenCalledWith(msg2)
  })

  it('aplica reintento con backoff si el servicio de mensajería falla', async () => {
    const msg = createSampleMessage('msg-fail', 'Error de prueba', 0)

    vi.mocked(mockOutboxRepo.claimPendingBatch).mockResolvedValue([msg])
    vi.mocked(mockMessengerService.sendMessage).mockResolvedValue({
      success: false,
      error: 'Telegram rate limit',
    })

    const result = await worker.dispatchPendingBatch(10)

    expect(result.claimedCount).toBe(1)
    expect(result.sentCount).toBe(0)
    expect(result.failedCount).toBe(1)

    expect(msg.getStatus()).toBe('failed')
    expect(msg.getRetryCount()).toBe(1)
    expect(msg.getLastError()).toBe('Telegram rate limit')
    expect(mockOutboxRepo.update).toHaveBeenCalledWith(msg)
  })

  it('marca como dead si se excede el número máximo de reintentos', async () => {
    // maxRetries es 3, creamos con retryCount = 2
    const msg = createSampleMessage('msg-dead', 'Mensaje moribundo', 2)

    vi.mocked(mockOutboxRepo.claimPendingBatch).mockResolvedValue([msg])
    vi.mocked(mockMessengerService.sendMessage).mockResolvedValue({
      success: false,
      error: 'Chat not found',
    })

    const result = await worker.dispatchPendingBatch(10)

    expect(result.failedCount).toBe(1)
    expect(msg.getStatus()).toBe('dead')
    expect(msg.getRetryCount()).toBe(3)
    expect(mockOutboxRepo.update).toHaveBeenCalledWith(msg)
  })
})
