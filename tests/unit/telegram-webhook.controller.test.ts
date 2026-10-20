import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramWebhookController } from '../../src/modules/messaging/interfaces/http/telegram-webhook.controller.js'
import type { IInboxRepository, SaveRawEventResult } from '../../src/modules/messaging/domain/ports/inbox-repository.port.js'
import type { InboxEvent } from '../../src/modules/messaging/domain/entities/inbox-event.entity.js'
import { env } from '../../src/config/env.js'

describe('TelegramWebhookController (Etapa 1 Ingesta Idempotente)', () => {
  let mockInboxRepo: IInboxRepository
  let controller: TelegramWebhookController
  let mockReq: any
  let mockRes: any

  beforeEach(() => {
    mockInboxRepo = {
      saveRawEvent: vi.fn().mockResolvedValue({
        inserted: true,
        id: 'mock-inbox-id-123',
      } as SaveRawEventResult),
      update: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByExternalMessage: vi.fn().mockResolvedValue(null),
      claimForProcessing: vi.fn().mockResolvedValue(true),
    }

    controller = new TelegramWebhookController(mockInboxRepo)

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
  })

  it('rechaza con 401 si el secret token de Telegram no coincide', async () => {
    const originalSecret = env.TELEGRAM_WEBHOOK_SECRET
    // Forzamos un secret temporal
    ;(env as any).TELEGRAM_WEBHOOK_SECRET = 'secret_token_seguro'

    try {
      mockReq = {
        headers: {
          'x-telegram-bot-api-secret-token': 'token_incorrecto',
        },
        body: {
          update_id: 1001,
          message: {
            message_id: 1,
            chat: { id: 12345 },
            text: '1200 gasolina',
          },
        },
      }

      await controller.handle(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fail' })
      )
      expect(mockInboxRepo.saveRawEvent).not.toHaveBeenCalled()
    } finally {
      ;(env as any).TELEGRAM_WEBHOOK_SECRET = originalSecret
    }
  })

  it('ingesta exitosamente un mensaje de texto y retorna 200 con eventId', async () => {
    mockReq = {
      headers: {},
      body: {
        update_id: 998877,
        message: {
          message_id: 42,
          from: { id: 777, first_name: 'Juan' },
          chat: { id: 12345 },
          text: '1200 de gasolina y 300 cena',
        },
      },
    }

    await controller.handle(mockReq, mockRes)

    expect(mockInboxRepo.saveRawEvent).toHaveBeenCalledTimes(1)
    const savedEvent = (mockInboxRepo.saveRawEvent as any).mock.calls[0][0] as InboxEvent
    expect(savedEvent.getProvider()).toBe('telegram')
    expect(savedEvent.getExternalUpdateId()).toBe('998877')
    expect(savedEvent.getExternalChatId()).toBe('12345')
    expect(savedEvent.getExternalMessageId()).toBe('42')
    expect(savedEvent.getSenderId()).toBe('777')
    expect(savedEvent.getMessageType()).toBe('text')

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'ok',
      eventId: 'mock-inbox-id-123',
      inserted: true,
    })
  })

  it('maneja duplicados de forma idempotente cuando saveRawEvent retorna inserted: false', async () => {
    ;(mockInboxRepo.saveRawEvent as any).mockResolvedValue({
      inserted: false,
      id: 'existing-event-id-999',
    })

    mockReq = {
      headers: {},
      body: {
        update_id: 998877,
        message: {
          message_id: 42,
          from: { id: 777 },
          chat: { id: 12345 },
          text: '1200 de gasolina',
        },
      },
    }

    await controller.handle(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'ok',
      eventId: 'existing-event-id-999',
      inserted: false,
    })
  })

  it('clasifica correctamente mensajes de voz como messageType "audio"', async () => {
    mockReq = {
      headers: {},
      body: {
        update_id: 554433,
        message: {
          message_id: 50,
          from: { id: 777 },
          chat: { id: 12345 },
          voice: { file_id: 'voice_abc_123', duration: 4 },
        },
      },
    }

    await controller.handle(mockReq, mockRes)

    expect(mockInboxRepo.saveRawEvent).toHaveBeenCalledTimes(1)
    const savedEvent = (mockInboxRepo.saveRawEvent as any).mock.calls[0][0] as InboxEvent
    expect(savedEvent.getMessageType()).toBe('audio')
    expect(mockRes.status).toHaveBeenCalledWith(200)
  })

  it('clasifica fotos como messageType "image"', async () => {
    mockReq = {
      headers: {},
      body: {
        update_id: 554434,
        message: {
          message_id: 51,
          from: { id: 777 },
          chat: { id: 12345 },
          photo: [{ file_id: 'photo_small' }, { file_id: 'photo_large' }],
        },
      },
    }

    await controller.handle(mockReq, mockRes)

    const savedEvent = (mockInboxRepo.saveRawEvent as any).mock.calls[0][0] as InboxEvent
    expect(savedEvent.getMessageType()).toBe('image')
    expect(mockRes.status).toHaveBeenCalledWith(200)
  })

  it('responde 200 ignored si el update no contiene mensaje o no es soportado', async () => {
    mockReq = {
      headers: {},
      body: {
        update_id: 112233,
        // Sin campo message (ej. inline_query o channel_post)
      },
    }

    await controller.handle(mockReq, mockRes)

    expect(mockInboxRepo.saveRawEvent).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ignored' })
    )
  })

  it('responde 500 si la base de datos lanza un error inesperado al guardar', async () => {
    ;(mockInboxRepo.saveRawEvent as any).mockRejectedValue(new Error('PostgreSQL connection drop'))

    mockReq = {
      headers: {},
      body: {
        update_id: 998877,
        message: {
          message_id: 42,
          from: { id: 777 },
          chat: { id: 12345 },
          text: '1200 gasolina',
        },
      },
    }

    await controller.handle(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'error',
      error: 'Error interno en ingesta',
    })
  })
})
