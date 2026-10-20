// ==============================================================================
// 🏛️ AUREUS · DOMAIN PORT: MESSENGER SERVICE (DESPACHO EXTERNO DE MENSAJERÍA)
// ==============================================================================

import type { ChannelProvider } from '../entities/inbox-event.entity.js'

export interface SendMessageResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

export interface IMessengerService {
  /**
   * Envía un mensaje saliente al canal especificado (Telegram / WhatsApp).
   */
  sendMessage(
    provider: ChannelProvider,
    recipientId: string,
    text: string
  ): Promise<SendMessageResult>
}
