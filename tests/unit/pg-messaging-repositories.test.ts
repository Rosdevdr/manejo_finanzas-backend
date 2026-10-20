import { describe, it, expect, vi, beforeEach } from 'vitest'
import type pg from 'pg'
import { PgInboxRepository } from '../../src/modules/messaging/infrastructure/persistence/pg-inbox.repository.js'
import { PgOutboxRepository } from '../../src/modules/messaging/infrastructure/persistence/pg-outbox.repository.js'
import { InboxEvent } from '../../src/modules/messaging/domain/entities/inbox-event.entity.js'
import { OutboxMessage } from '../../src/modules/messaging/domain/entities/outbox-message.entity.js'

describe('Infrastructure: Messaging Repositories (Inbox & Outbox)', () => {
  let mockPool: {
    query: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    }
  })

  describe('PgInboxRepository', () => {
    it('debe devolver inserted: true e ID cuando el evento es nuevo', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'new-inbox-id' }] })

      const repo = new PgInboxRepository(mockPool as unknown as pg.Pool)
      const event = InboxEvent.createReceived({
        provider: 'telegram',
        externalChatId: 'chat-1',
        externalMessageId: 'msg-1',
        senderId: 'user-1',
        messageType: 'text',
        rawPayload: { text: 'hola' },
      })

      const result = await repo.saveRawEvent(event)

      expect(result.inserted).toBe(true)
      expect(result.id).toBe('new-inbox-id')
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (provider, external_chat_id, external_message_id) DO NOTHING'),
        expect.any(Array)
      )
    })

    it('debe devolver inserted: false y recuperar ID existente ante conflicto concurrente', async () => {
      // 1ra consulta (INSERT) no retorna filas (conflicto)
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      // 2da consulta (SELECT) retorna el id existente
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'existing-inbox-id' }] })

      const repo = new PgInboxRepository(mockPool as unknown as pg.Pool)
      const event = InboxEvent.createReceived({
        provider: 'telegram',
        externalChatId: 'chat-1',
        externalMessageId: 'msg-1',
        senderId: 'user-1',
        messageType: 'text',
        rawPayload: { text: 'hola' },
      })

      const result = await repo.saveRawEvent(event)

      expect(result.inserted).toBe(false)
      expect(result.id).toBe('existing-inbox-id')
    })

    it('debe retornar true solo si claimForProcessing actualizó el registro atómicamente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'event-1' }] })

      const repo = new PgInboxRepository(mockPool as unknown as pg.Pool)
      const success = await repo.claimForProcessing('event-1')

      expect(success).toBe(true)
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1 AND status IN ('extracted', 'needs_review')"),
        ['event-1']
      )
    })
  })

  describe('PgOutboxRepository', () => {
    it('debe encolar el mensaje correctamente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })

      const repo = new PgOutboxRepository(mockPool as unknown as pg.Pool)
      const msg = OutboxMessage.create({
        provider: 'telegram',
        recipientId: 'chat-100',
        payload: { text: 'Confirmado' },
      })

      await repo.enqueue(msg)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO outbox_messages'),
        expect.any(Array)
      )
    })

    it('debe reclamar mensajes usando FOR UPDATE SKIP LOCKED', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-1',
            source_event_id: 'ev-1',
            provider: 'telegram',
            recipient_id: 'chat-1',
            message_type: 'text',
            payload: { text: 'Hola' },
            status: 'processing',
            retry_count: 0,
            max_retries: 5,
            locked_until: new Date(),
            next_attempt_at: new Date(),
            last_error: null,
            created_at: new Date(),
            sent_at: null,
          },
        ],
      })

      const repo = new PgOutboxRepository(mockPool as unknown as pg.Pool)
      const batch = await repo.claimPendingBatch(5, 30)

      expect(batch).toHaveLength(1)
      expect(batch[0].getId()).toBe('msg-1')
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
        [5, 30]
      )
    })
  })
})
