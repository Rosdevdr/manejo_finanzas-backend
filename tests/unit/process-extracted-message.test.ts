import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ProcessExtractedMessageUseCase,
  InboxEventNotFoundError,
  InvalidExtractedDataError,
} from '../../src/modules/ledger/application/use-cases/process-extracted-message.use-case.js'
import { InboxEvent } from '../../src/modules/messaging/domain/entities/inbox-event.entity.js'
import type { IInboxRepository } from '../../src/modules/messaging/domain/ports/inbox-repository.port.js'
import type { ILedgerRepository } from '../../src/modules/ledger/domain/ports/ledger-repository.port.js'
import type { IOutboxRepository } from '../../src/modules/messaging/domain/ports/outbox-repository.port.js'
import type { IUnitOfWork } from '../../src/shared/application/ports/unit-of-work.port.js'

describe('Application: ProcessExtractedMessageUseCase (Etapa 3 ACID)', () => {
  let mockInboxRepo: {
    findById: ReturnType<typeof vi.fn>
    claimForProcessing: ReturnType<typeof vi.fn>
    saveRawEvent: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findByExternalMessage: ReturnType<typeof vi.fn>
  }
  let mockLedgerRepo: {
    append: ReturnType<typeof vi.fn>
    appendBatch: ReturnType<typeof vi.fn>
    findById: ReturnType<typeof vi.fn>
    findBySourceEvent: ReturnType<typeof vi.fn>
    findReversalOf: ReturnType<typeof vi.fn>
    listByHousehold: ReturnType<typeof vi.fn>
  }
  let mockOutboxRepo: {
    enqueue: ReturnType<typeof vi.fn>
    claimPendingBatch: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findById: ReturnType<typeof vi.fn>
  }
  let mockUnitOfWork: IUnitOfWork

  const dummyHouseholdId = '11111111-1111-4111-a111-111111111111'
  const dummyUserId = '22222222-2222-4222-a222-222222222222'

  beforeEach(() => {
    mockInboxRepo = {
      findById: vi.fn(),
      claimForProcessing: vi.fn().mockResolvedValue(true),
      saveRawEvent: vi.fn(),
      update: vi.fn(),
      findByExternalMessage: vi.fn(),
    }
    mockLedgerRepo = {
      append: vi.fn(),
      appendBatch: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findBySourceEvent: vi.fn(),
      findReversalOf: vi.fn(),
      listByHousehold: vi.fn(),
    }
    mockOutboxRepo = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      claimPendingBatch: vi.fn(),
      update: vi.fn(),
      findById: vi.fn(),
    }
    // UnitOfWork passthrough en tests unitarios
    mockUnitOfWork = {
      execute: vi.fn().mockImplementation(async work => await work()),
    }
  })

  it('debe procesar exitosamente un mensaje con múltiples gastos de forma atómica', async () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-456',
      externalMessageId: 'msg-789',
      senderId: 'user-001',
      messageType: 'text',
      rawPayload: { text: '1200 de gasolina y 300 de cena' },
    })

    event.markExtracted({
      extractedData: {
        items: [
          { amount: '1200.00', description: 'Gasolina', category: 'transport' },
          { amount: '300.00', description: 'Cena', category: 'food' },
        ],
      },
      aiModel: 'gemini-flash-latest',
      promptVersion: 'v1.0.0',
      confidenceScore: 0.98,
    })

    mockInboxRepo.findById.mockResolvedValueOnce(event)

    const useCase = new ProcessExtractedMessageUseCase(
      mockInboxRepo as unknown as IInboxRepository,
      mockLedgerRepo as unknown as ILedgerRepository,
      mockOutboxRepo as unknown as IOutboxRepository,
      mockUnitOfWork
    )

    const result = await useCase.execute({
      inboxEventId: event.getId(),
      householdId: dummyHouseholdId,
      userId: dummyUserId,
      currency: 'DOP',
    })

    expect(result.success).toBe(true)
    expect(result.entriesCount).toBe(2)
    expect(result.totalFormatted).toBe('DOP $1,500.00')

    // 1. Verificó la guardia de concurrencia
    expect(mockInboxRepo.claimForProcessing).toHaveBeenCalledWith(event.getId())

    // 2. Insertó en lote en el Ledger con las líneas 1 y 2
    expect(mockLedgerRepo.appendBatch).toHaveBeenCalledTimes(1)
    const [entriesPassed] = mockLedgerRepo.appendBatch.mock.calls[0]
    expect(entriesPassed).toHaveLength(2)
    expect(entriesPassed[0].getSourceLine()).toBe(1)
    expect(entriesPassed[0].getAmount().getCents()).toBe(120000)
    expect(entriesPassed[1].getSourceLine()).toBe(2)
    expect(entriesPassed[1].getAmount().getCents()).toBe(30000)

    // 3. Encoló el mensaje de respuesta en el Outbox
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1)
    const [outboxMsg] = mockOutboxRepo.enqueue.mock.calls[0]
    expect(outboxMsg.getRecipientId()).toBe('chat-456')
    expect(outboxMsg.getPayload().text).toContain('Gasolina: DOP $1,200.00')
    expect(outboxMsg.getPayload().text).toContain('Cena: DOP $300.00')
    expect(outboxMsg.getPayload().text).toContain('Total: DOP $1,500.00')

    // 4. Todo se ejecutó dentro de la frontera del UnitOfWork
    expect(mockUnitOfWork.execute).toHaveBeenCalledTimes(1)
  })

  it('debe abortar de forma segura si otro worker concurrente ya tomó el evento', async () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-456',
      externalMessageId: 'msg-789',
      senderId: 'user-001',
      messageType: 'text',
      rawPayload: {},
    })

    event.markExtracted({
      extractedData: { items: [{ amount: '500.00', description: 'Farmacia' }] },
      aiModel: 'test',
      promptVersion: 'v1',
    })

    mockInboxRepo.findById.mockResolvedValueOnce(event)
    // Simular que otro worker ya cambió el estado a processed
    mockInboxRepo.claimForProcessing.mockResolvedValueOnce(false)

    const useCase = new ProcessExtractedMessageUseCase(
      mockInboxRepo as unknown as IInboxRepository,
      mockLedgerRepo as unknown as ILedgerRepository,
      mockOutboxRepo as unknown as IOutboxRepository,
      mockUnitOfWork
    )

    const result = await useCase.execute({
      inboxEventId: event.getId(),
      householdId: dummyHouseholdId,
      userId: dummyUserId,
    })

    expect(result.success).toBe(false)
    expect(result.alreadyProcessed).toBe(true)
    expect(mockLedgerRepo.appendBatch).not.toHaveBeenCalled()
    expect(mockOutboxRepo.enqueue).not.toHaveBeenCalled()
  })

  it('debe lanzar error si el evento de inbox no existe', async () => {
    mockInboxRepo.findById.mockResolvedValueOnce(null)

    const useCase = new ProcessExtractedMessageUseCase(
      mockInboxRepo as unknown as IInboxRepository,
      mockLedgerRepo as unknown as ILedgerRepository,
      mockOutboxRepo as unknown as IOutboxRepository,
      mockUnitOfWork
    )

    await expect(
      useCase.execute({
        inboxEventId: 'non-existent-id',
        householdId: dummyHouseholdId,
        userId: dummyUserId,
      })
    ).rejects.toThrow(InboxEventNotFoundError)
  })

  it('debe lanzar error si el evento aún no ha sido extraído', async () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-1',
      externalMessageId: 'msg-1',
      senderId: 'user-1',
      messageType: 'text',
      rawPayload: {},
    })
    // Estado sigue en 'received'

    mockInboxRepo.findById.mockResolvedValueOnce(event)

    const useCase = new ProcessExtractedMessageUseCase(
      mockInboxRepo as unknown as IInboxRepository,
      mockLedgerRepo as unknown as ILedgerRepository,
      mockOutboxRepo as unknown as IOutboxRepository,
      mockUnitOfWork
    )

    await expect(
      useCase.execute({
        inboxEventId: event.getId(),
        householdId: dummyHouseholdId,
        userId: dummyUserId,
      })
    ).rejects.toThrow(InvalidExtractedDataError)
  })

  it('concilia automáticamente con el Centinela Anti-Moras e incluye nota de ahorro en el Outbox', async () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-456',
      externalMessageId: 'msg-789',
      senderId: 'user-001',
      messageType: 'text',
      rawPayload: { text: '2350 de luz edesur' },
    })
    event.markExtracted({
      extractedData: {
        items: [
          { amount: '2350.00', description: 'Pago de luz Edesur', kind: 'expense' },
        ],
      },
      aiModel: 'gemini-flash-latest',
      promptVersion: 'v1.0.0',
      confidenceScore: 0.98,
    })
    mockInboxRepo.findById.mockResolvedValueOnce(event)


    const mockMatchPaymentUseCase = {
      execute: vi.fn().mockResolvedValue({
        matched: true,
        commitmentName: 'Luz Edesur',
        savedLateFeeFormatted: 'DOP $600.00',
      }),
    }

    const useCase = new ProcessExtractedMessageUseCase(
      mockInboxRepo as unknown as IInboxRepository,
      mockLedgerRepo as unknown as ILedgerRepository,
      mockOutboxRepo as unknown as IOutboxRepository,
      mockUnitOfWork,
      mockMatchPaymentUseCase as any
    )

    const result = await useCase.execute({
      inboxEventId: event.getId(),
      householdId: dummyHouseholdId,
      userId: dummyUserId,
    })

    expect(result.success).toBe(true)
    expect(mockMatchPaymentUseCase.execute).toHaveBeenCalledTimes(1)
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1)
    const enqueuedMsg = mockOutboxRepo.enqueue.mock.calls[0][0]
    expect(enqueuedMsg.getPayload().text).toContain('Luz Edesur')
    expect(enqueuedMsg.getPayload().text).toContain('DOP $600.00')
  })
})

