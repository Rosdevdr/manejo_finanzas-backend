// ==============================================================================
// 🛡️ AUREUS · DOMAIN PORT: SENTINEL REPOSITORY (PERSISTENCIA DEL CENTINELA)
// ==============================================================================

import type { RecurringCommitment } from '../entities/recurring-commitment.entity.js'
import type { CommitmentCycle } from '../entities/commitment-cycle.entity.js'

export interface CommitmentWithCycle {
  commitment: RecurringCommitment
  cycle: CommitmentCycle
}

export interface ISentinelRepository {
  /**
   * Guarda o actualiza un compromiso recurrente.
   */
  saveCommitment(commitment: RecurringCommitment): Promise<void>

  /**
   * Busca un compromiso por ID.
   */
  findCommitmentById(id: string): Promise<RecurringCommitment | null>

  /**
   * Obtiene todos los compromisos activos de un hogar.
   */
  listActiveCommitments(householdId: string): Promise<RecurringCommitment[]>

  /**
   * Busca el ciclo de un compromiso en un periodo dado (ej: '2026-10').
   */
  findCycleByCommitmentAndPeriod(
    commitmentId: string,
    billingPeriod: string
  ): Promise<CommitmentCycle | null>

  /**
   * Obtiene o genera el ciclo mensual para un compromiso en un periodo dado.
   */
  findOrCreateCycle(
    commitment: RecurringCommitment,
    billingPeriod: string
  ): Promise<CommitmentCycle>

  /**
   * Lista todos los ciclos pendientes u overdue que vencen dentro del horizonte temporal para el escaneo centinela.
   */
  listPendingCyclesForScan(
    asOfDate: Date,
    horizonDays?: number
  ): Promise<CommitmentWithCycle[]>

  /**
   * Actualiza el estado, pago o alertas enviadas de un ciclo.
   */
  updateCycle(cycle: CommitmentCycle): Promise<void>

  /**
   * Busca un ciclo pendiente que coincida con términos de descripción (ej: 'edesur', 'luz', 'claro')
   * para conciliación automática de pagos.
   */
  findPendingCycleByTerms(
    householdId: string,
    billingPeriod: string,
    searchTerms: string[]
  ): Promise<CommitmentWithCycle | null>
}
