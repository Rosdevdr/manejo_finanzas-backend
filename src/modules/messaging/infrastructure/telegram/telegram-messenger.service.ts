// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: TELEGRAM MESSENGER SERVICE (BOT API DISPATCHER)
// ==============================================================================

import type { IMessengerService, SendMessageResult } from '../../domain/ports/messenger-service.port.js'
import type { ChannelProvider } from '../../domain/entities/inbox-event.entity.js'
import { env } from '../../../../config/env.js'

export class TelegramMessengerService implements IMessengerService {
  constructor(private readonly botToken: string = env.TELEGRAM_BOT_TOKEN) {}

  public async sendMessage(
    provider: ChannelProvider,
    recipientId: string,
    text: string
  ): Promise<SendMessageResult> {
    if (provider !== 'telegram') {
      return {
        success: false,
        error: `TelegramMessengerService no soporta el proveedor "${provider}"`,
      }
    }

    if (!this.botToken) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN no configurado en variables de entorno',
      }
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipientId,
          text,
          parse_mode: 'HTML',
        }),
      })

      const data = (await response.json()) as any

      if (response.ok && data?.ok) {
        return {
          success: true,
          externalMessageId: String(data.result?.message_id),
        }
      }

      return {
        success: false,
        error: data?.description || `HTTP ${response.status} de Telegram Bot API`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: (err as Error).message || 'Fallo de red conectando con Telegram API',
      }
    }
  }
}
