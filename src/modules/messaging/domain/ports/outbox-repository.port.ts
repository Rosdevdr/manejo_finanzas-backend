// ==============================================================================
// 🏛️ AUREUS · DOMAIN PORT: OUTBOX REPOSITORY (CONTRATO DE COLA TRANSACTORIAL)
// ==============================================================================

import type { OutboxMessage } from '../entities/outbox-message.entity.js'

export interface IOutboxRepository {
  /**
   * Encola un mensaje para ser enviado. Si se ejecuta dentro de un UnitOfWork,
   * se confirma atómicamente junto al asiento contable.
   */
  enqueue(message: OutboxMessage): Promise<void>

  /**
   * Reclama un lote de mensajes pendientes o reintentables usando SKIP LOCKED
   * para evitar condiciones de carrera entre workers paralelos.
   */
  claimPendingBatch(limit: number, lockDurationSeconds?: number): Promise<OutboxMessage[]>

  /**
   * Actualiza el estado (sent, failed, dead), intentos y fecha del siguiente reintento.
   */
  update(message: OutboxMessage): Promise<void>

  /**
   * Busca un mensaje por su ID.
   */
  findById(id: string): Promise<OutboxMessage | null>
}
