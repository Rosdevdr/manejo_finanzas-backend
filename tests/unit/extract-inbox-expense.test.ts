import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ExtractInboxExpenseUseCase,
  InboxEventNotFoundError,
} from '../../src/modules/ledger/application/use-cases/extract-inbox-expense.use-case.js'
import { InboxEvent } from '../../src/modules/messaging/domain/entities/inbox-event.entity.js'
import type { IInboxRepository } from '../../src/modules/messaging/domain/ports/inbox-repository.port.js'
import type { IExpenseExtractor, ExtractionResult } from '../../src/modules/ledger/domain/ports/expense-extractor.port.js'

describe('ExtractInboxExpenseUseCase (Etapa 2 Extracción con IA)', () => {
  let mockInboxRepo: IInboxRepository
  let mockExtractor: IExpenseExtractor
  let useCase: ExtractInboxExpenseUseCase

  const createSampleInboxEvent = (status: 'received' | 'extracted' | 'processed' = 'received', text = '1200 gasolina') => {
    return InboxEvent.reconstitute({
      id: 'event-uuid-1',
      provider: 'telegram',
      externalUpdateId: 'up-1',
      externalChatId: 'chat-1',
      externalMessageId: 'msg-1',
      senderId: 'user-1',
      messageType: 'text',
      rawPayload: {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 'chat-1' },
          text,
        },
      },
      status,
      errorMessage: null,
      extractedData: status !== 'received' ? { items: [{ amount: '1200', description: 'Gasolina' }] } : null,
      aiModel: status !== 'received' ? 'gemini-flash' : null,
      promptVersion: status !== 'received' ? 'v1.1.0' : null,
      confidenceScore: status !== 'received' ? 0.95 : null,
      createdAt: new Date('2026-10-20T10:00:00Z'),
      processedAt: status === 'processed' ? new Date('2026-10-20T10:01:00Z') : null,
    })
  }

  beforeEach(() => {
    mockInboxRepo = {
      saveRawEvent: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByExternalMessage: vi.fn(),
      claimForProcessing: vi.fn(),
    }

    mockExtractor = {
      extractFromText: vi.fn(),
    }

    useCase = new ExtractInboxExpenseUseCase(mockInboxRepo, mockExtractor)
  })

  it('lanza InboxEventNotFoundError si el evento no existe', async () => {
    vi.mocked(mockInboxRepo.findById).mockResolvedValue(null)

    await expect(
      useCase.execute({ inboxEventId: 'no-existe' })
    ).rejects.toThrow(InboxEventNotFoundError)
  })

  it('no vuelve a invocar a Gemini si el evento ya estaba extraído o procesado', async () => {
    const existing = createSampleInboxEvent('extracted')
    vi.mocked(mockInboxRepo.findById).mockResolvedValue(existing)

    const result = await useCase.execute({ inboxEventId: 'event-uuid-1' })

    expect(result.status).toBe('already_processed')
    expect(mockExtractor.extractFromText).not.toHaveBeenCalled()
    expect(mockInboxRepo.update).not.toHaveBeenCalled()
  })

  it('procesa texto exitosamente, actualiza estado a extracted y guarda datos de auditoría', async () => {
    const event = createSampleInboxEvent('received', '1200 de gasolina')
    vi.mocked(mockInboxRepo.findById).mockResolvedValue(event)

    const extractionResult: ExtractionResult = {
      items: [
        {
          amount: '1200.00',
          description: 'Gasolina',
          category: 'transport',
          kind: 'expense',
        },
      ],
      confidenceScore: 0.98,
      isAmbiguous: false,
      rawResponse: { candidates: [] },
      model: 'gemini-flash-latest',
      promptVersion: 'v1.1.0',
    }

    vi.mocked(mockExtractor.extractFromText).mockResolvedValue(extractionResult)

    const result = await useCase.execute({ inboxEventId: 'event-uuid-1' })

    expect(result.status).toBe('extracted')
    expect(result.items).toHaveLength(1)
    expect(event.getStatus()).toBe('extracted')
    expect(event.getAiModel()).toBe('gemini-flash-latest')
    expect(event.getConfidenceScore()).toBe(0.98)
    expect(mockInboxRepo.update).toHaveBeenCalledWith(event)
  })

  it('marca needs_review si la IA reporta ambigüedad en el mensaje', async () => {
    const event = createSampleInboxEvent('received', 'ayer salí al mall')
    vi.mocked(mockInboxRepo.findById).mockResolvedValue(event)

    vi.mocked(mockExtractor.extractFromText).mockResolvedValue({
      items: [],
      confidenceScore: 0.2,
      isAmbiguous: true,
      clarificationQuestion: '¿Cuánto gastaste en el mall?',
      rawResponse: {},
      model: 'gemini-flash-latest',
      promptVersion: 'v1.1.0',
    })

    const result = await useCase.execute({ inboxEventId: 'event-uuid-1' })

    expect(result.status).toBe('needs_review')
    expect(result.clarificationQuestion).toBe('¿Cuánto gastaste en el mall?')
    expect(event.getStatus()).toBe('needs_review')
    expect(mockInboxRepo.update).toHaveBeenCalledWith(event)
  })

  it('marca failed y persiste el error si el extractor de IA arroja excepción', async () => {
    const event = createSampleInboxEvent('received', '500 de empanadas')
    vi.mocked(mockInboxRepo.findById).mockResolvedValue(event)
    vi.mocked(mockExtractor.extractFromText).mockRejectedValue(new Error('Google API quota exceeded'))

    const result = await useCase.execute({ inboxEventId: 'event-uuid-1' })

    expect(result.status).toBe('failed')
    expect(event.getStatus()).toBe('failed')
    expect(event.getErrorMessage()).toBe('Google API quota exceeded')
    expect(mockInboxRepo.update).toHaveBeenCalledWith(event)
  })
})
