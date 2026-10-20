import { describe, it, expect } from 'vitest'
import { InboxEvent, InvalidInboxEventError } from '../../src/modules/messaging/domain/entities/inbox-event.entity.js'

describe('Domain Entity: InboxEvent', () => {
  it('debe inicializarse con estado received y campos limpios', () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-123',
      externalMessageId: 'msg-456',
      senderId: 'user-789',
      messageType: 'text',
      rawPayload: { text: '1200 de gasolina' },
    })

    expect(event.getId()).toBeDefined()
    expect(event.getStatus()).toBe('received')
    expect(event.getExtractedData()).toBeNull()
    expect(event.getProcessedAt()).toBeNull()
  })

  it('debe transicionar a extracted con los metadatos de IA', () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-123',
      externalMessageId: 'msg-456',
      senderId: 'user-789',
      messageType: 'text',
      rawPayload: { text: '1200 de gasolina' },
    })

    event.markExtracted({
      extractedData: { items: [{ amount: 1200, category: 'transport' }] },
      aiModel: 'gemini-flash-latest',
      promptVersion: 'v1.0.0',
      confidenceScore: 0.95,
    })

    expect(event.getStatus()).toBe('extracted')
    expect(event.getAiModel()).toBe('gemini-flash-latest')
    expect(event.getConfidenceScore()).toBe(0.95)
  })

  it('debe transicionar a processed solo si fue extracted o needs_review', () => {
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalChatId: 'chat-123',
      externalMessageId: 'msg-456',
      senderId: 'user-789',
      messageType: 'text',
      rawPayload: {},
    })

    // Intentar procesar directamente desde received debe fallar
    expect(() => event.markProcessed()).toThrow(InvalidInboxEventError)

    event.markExtracted({
      extractedData: { ok: true },
      aiModel: 'test-model',
      promptVersion: 'v1',
    })

    event.markProcessed()
    expect(event.getStatus()).toBe('processed')
    expect(event.getProcessedAt()).toBeInstanceOf(Date)
  })
})
