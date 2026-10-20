// ==============================================================================
// 🏛️ AUREUS · DOMAIN PORT: INBOX REPOSITORY (CONTRATO DE INGESTA IDEMPOTENTE)
// ==============================================================================

import type { InboxEvent, ChannelProvider } from '../entities/inbox-event.entity.js'

export interface SaveRawEventResult {
  inserted: boolean
  id: string
}

export interface IInboxRepository {
  /**
   * Intenta persistir el evento crudo de forma atómica e idempotente.
   * Si ya existe un registro con la misma clave (provider, external_chat_id, external_message_id),
   * no duplica ni falla: retorna `inserted: false` junto al id existente.
   */
  saveRawEvent(event: InboxEvent): Promise<SaveRawEventResult>

  /**
   * Actualiza el estado, datos extraídos o errores de un evento de inbox existente.
   */
  update(event: InboxEvent): Promise<void>

  /**
   * Busca un evento por su ID primario.
   */
  findById(id: string): Promise<InboxEvent | null>

  /**
   * Busca un evento por su identificador externo de mensajería.
   */
  findByExternalMessage(provider: ChannelProvider, chatId: string, messageId: string): Promise<InboxEvent | null>

  /**
   * Guardia de concurrencia para la Etapa 3:
   * Intenta transicionar atómicamente el estado a 'processed'.
   * Si devuelve false, otro worker concurrente ya tomó o procesó el evento.
   */
  claimForProcessing(id: string): Promise<boolean>
}
