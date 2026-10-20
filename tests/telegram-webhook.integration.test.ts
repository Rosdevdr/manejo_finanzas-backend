import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { PgInboxRepository } from '../src/modules/messaging/infrastructure/persistence/pg-inbox.repository.js'

describe('Integration: POST /api/webhooks/telegram', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna 200 con status ok e ID cuando recibe un mensaje de Telegram válido', async () => {
    vi.spyOn(PgInboxRepository.prototype, 'saveRawEvent').mockResolvedValue({
      inserted: true,
      id: 'mock-inbox-uuid-456',
    })

    const payload = {
      update_id: 123456789,
      message: {
        message_id: 88,
        from: { id: 987654321, first_name: 'Familia Aureus' },
        chat: { id: 987654321, type: 'private' },
        text: '1500 de supermercado Bravo',
      },
    }

    const res = await request(app)
      .post('/api/webhooks/telegram')
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ok',
      eventId: 'mock-inbox-uuid-456',
      inserted: true,
    })
  })

  it('retorna 200 con status ignored si el update de Telegram no es un mensaje procesable', async () => {
    const res = await request(app)
      .post('/api/webhooks/telegram')
      .send({
        update_id: 123456790,
        // Sin campo message
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ignored',
      reason: 'Update no contiene mensaje',
    })
  })
})
