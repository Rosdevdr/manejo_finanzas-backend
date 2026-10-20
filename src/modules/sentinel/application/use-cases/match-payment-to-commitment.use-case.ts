// ==============================================================================
// 🛡️ AUREUS · APPLICATION USE CASE: CONCILIAR PAGO CON COMPROMISO CENTINELA
// ==============================================================================

import type { ISentinelRepository } from '../../domain/ports/sentinel-repository.port.js'
import type { Money } from '../../../../shared/domain/value-objects/money.vo.js'

export interface MatchPaymentCommand {
  householdId: string
  ledgerEntryId: string
  description: string
  amount: Money
  transactedAt?: Date
}

export interface MatchPaymentResult {
  matched: boolean
  commitmentId?: string
  commitmentName?: string
  cycleId?: string
  savedLateFeeFormatted?: string
}

export class MatchPaymentToCommitmentUseCase {
  constructor(private readonly sentinelRepo: ISentinelRepository) {}

  public async execute(command: MatchPaymentCommand): Promise<MatchPaymentResult> {
    const { householdId, ledgerEntryId, description, amount } = command
    const transactedAt = command.transactedAt || new Date()

    // 1. Determinar periodo mensual (ej: '2026-10')
    const billingPeriod = `${transactedAt.getUTCFullYear()}-${String(
      transactedAt.getUTCMonth() + 1
    ).padStart(2, '0')}`

    // 2. Extraer términos significativos de búsqueda (palabras >= 3 caracteres ignorando stopwords comunes)
    const stopwords = new Set(['pago', 'factura', 'de', 'del', 'la', 'el', 'los', 'las', 'por', 'con', 'para'])
    const terms = description
      .toLowerCase()
      .replace(/[^a-záéíóúñ0-9\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopwords.has(w))

    if (terms.length === 0) {
      return { matched: false }
    }

    // 3. Buscar ciclo pendiente en el hogar que coincida con los términos
    const match = await this.sentinelRepo.findPendingCycleByTerms(
      householdId,
      billingPeriod,
      terms
    )

    if (!match) {
      return { matched: false }
    }

    const { commitment, cycle } = match

    // 4. Marcar ciclo como pagado
    cycle.markPaid(ledgerEntryId, amount, transactedAt)
    await this.sentinelRepo.updateCycle(cycle)

    return {
      matched: true,
      commitmentId: commitment.getId(),
      commitmentName: commitment.getName(),
      cycleId: cycle.getId(),
      savedLateFeeFormatted: commitment.getEstimatedLateFee().format(),
    }
  }
}
