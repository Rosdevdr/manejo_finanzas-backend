import { describe, it, expect } from 'vitest'
import { OutboxMessage } from '../../src/modules/messaging/domain/entities/outbox-message.entity.js'

describe('Domain Entity: OutboxMessage', () => {
  it('debe inicializarse en estado pending con reintentos en 0', () => {
    const msg = OutboxMessage.create({
      provider: 'telegram',
      recipientId: 'chat-999',
      payload: { text: 'Gasto anotado exitosamente' },
    })

    expect(msg.getStatus()).toBe('pending')
    expect(msg.getRetryCount()).toBe(0)
    expect(msg.getSentAt()).toBeNull()
  })

  it('debe transicionar a sent y limpiar el bloqueo al confirmarse', () => {
    const msg = OutboxMessage.create({
      provider: 'telegram',
      recipientId: 'chat-999',
      payload: { text: 'Mensaje' },
    })

    msg.claim(60)
    expect(msg.getStatus()).toBe('processing')
    expect(msg.getLockedUntil()).not.toBeNull()

    msg.markSent()
    expect(msg.getStatus()).toBe('sent')
    expect(msg.getSentAt()).not.toBeNull()
    expect(msg.getLockedUntil()).toBeNull()
  })

  it('debe incrementar intentos y transicionar a dead al superar maxRetries', () => {
    const msg = OutboxMessage.create({
      provider: 'telegram',
      recipientId: 'chat-999',
      payload: { text: 'Mensaje' },
      maxRetries: 2,
    })

    msg.markFailed('Network timeout 1')
    expect(msg.getStatus()).toBe('failed')
    expect(msg.getRetryCount()).toBe(1)
    expect(msg.getNextAttemptAt().getTime()).toBeGreaterThan(Date.now())

    msg.markFailed('Network timeout 2')
    expect(msg.getStatus()).toBe('dead')
    expect(msg.getRetryCount()).toBe(2)
  })
})
