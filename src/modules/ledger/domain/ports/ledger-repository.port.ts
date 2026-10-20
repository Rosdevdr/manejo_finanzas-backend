// ==============================================================================
// 🏛️ AUREUS · DOMAIN PORT: LEDGER REPOSITORY (CONTRATO DE PERSISTENCIA)
// ==============================================================================

import type { LedgerEntry } from '../entities/ledger-entry.entity.js'

export interface ListLedgerOptions {
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

export interface ILedgerRepository {
  /**
   * Inserta una nueva entrada en el libro contable inmutable.
   */
  append(entry: LedgerEntry): Promise<void>

  /**
   * Inserta un lote de entradas contables (por ejemplo, múltiples líneas de un mismo mensaje).
   */
  appendBatch(entries: LedgerEntry[]): Promise<void>

  /**
   * Busca una entrada específica por su identificador único.
   */
  findById(id: string): Promise<LedgerEntry | null>

  /**
   * Obtiene todas las líneas generadas a partir de un evento de inbox específico.
   */
  findBySourceEvent(sourceEventId: string): Promise<LedgerEntry[]>

  /**
   * Busca si una entrada ya cuenta con una reversión registrada.
   */
  findReversalOf(originalEntryId: string): Promise<LedgerEntry | null>

  /**
   * Lista las entradas de un hogar ordenadas cronológicamente de forma descendente.
   */
  listByHousehold(householdId: string, options?: ListLedgerOptions): Promise<LedgerEntry[]>
}
