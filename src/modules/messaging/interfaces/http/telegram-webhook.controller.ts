// ==============================================================================
// 🏛️ AUREUS · INTERFACES: TELEGRAM WEBHOOK CONTROLLER (ETAPA 1 ATÓMICA)
// ==============================================================================

import type { Request, Response } from 'express'
import { z } from 'zod'
import type { IInboxRepository } from '../../domain/ports/inbox-repository.port.js'
import { InboxEvent, type MessageType } from '../../domain/entities/inbox-event.entity.js'
import { env } from '../../../../config/env.js'
import { PgInboxRepository } from '../../infrastructure/persistence/pg-inbox.repository.js'

export const telegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      from: z
        .object({
          id: z.number().int(),
          first_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({
        id: z.number().int(),
        type: z.string().optional(),
      }),
      text: z.string().optional(),
      voice: z
        .object({
          file_id: z.string(),
          duration: z.number().optional(),
        })
        .optional(),
      photo: z
        .array(
          z.object({
            file_id: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
})

export class TelegramWebhookController {
  constructor(private readonly inboxRepo: IInboxRepository = new PgInboxRepository()) {}

  public handle = async (req: Request, res: Response): Promise<void> => {
    // 1. Verificación del token secreto de Telegram (si está configurado)
    const secretHeader = req.headers['x-telegram-bot-api-secret-token']
    if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      res.status(401).json({ status: 'fail', error: 'Token secreto de Telegram inválido' })
      return
    }

    // 2. Validación de contrato del payload de Telegram
    const parsed = telegramUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      // Respondemos 200 a Telegram para que no se atasque en reintentos infinitos si manda updates que no nos interesan (ej. channel_post)
      res.status(200).json({ status: 'ignored', reason: 'Payload no es un mensaje procesable' })
      return
    }

    const { update_id, message } = parsed.data
    if (!message) {
      res.status(200).json({ status: 'ignored', reason: 'Update no contiene mensaje' })
      return
    }

    // 3. Determinar tipo de mensaje
    let messageType: MessageType = 'text'
    if (message.voice) {
      messageType = 'audio'
    } else if (message.photo && message.photo.length > 0) {
      messageType = 'image'
    } else if (!message.text) {
      res.status(200).json({ status: 'ignored', reason: 'Tipo de mensaje no soportado' })
      return
    }

    const chatId = String(message.chat.id)
    const messageId = String(message.message_id)
    const senderId = message.from ? String(message.from.id) : chatId

    // 4. Instanciar entidad InboxEvent
    const event = InboxEvent.createReceived({
      provider: 'telegram',
      externalUpdateId: String(update_id),
      externalChatId: chatId,
      externalMessageId: messageId,
      senderId,
      messageType,
      rawPayload: req.body,
    })

    // 5. Ingesta Idempotente en BD con ON CONFLICT DO NOTHING
    try {
      const result = await this.inboxRepo.saveRawEvent(event)

      // 6. Respuesta inmediata HTTP 200 (en milisegundos)
      res.status(200).json({
        status: 'ok',
        eventId: result.id,
        inserted: result.inserted,
      })
    } catch (err: unknown) {
      console.error('❌ Error guardando evento en inbox:', (err as Error).message)
      // Respondemos 500 para que Telegram reintente más tarde si la BD se cayó
      res.status(500).json({ status: 'error', error: 'Error interno en ingesta' })
    }
  }
}
