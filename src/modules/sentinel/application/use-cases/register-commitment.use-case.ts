// ==============================================================================
// 🛡️ AUREUS · APPLICATION USE CASE: REGISTRAR COMPROMISO RECURRENTE (CENTINELA)
// ==============================================================================

import type { ISentinelRepository } from '../../domain/ports/sentinel-repository.port.js'
import { RecurringCommitment } from '../../domain/entities/recurring-commitment.entity.js'
import { Money, type SupportedCurrency } from '../../../../shared/domain/value-objects/money.vo.js'

export interface RegisterCommitmentCommand {
  householdId: string
  name: string
  categoryId?: string | null
  expectedAmount?: string | number
  currency?: SupportedCurrency
  dueDayOfMonth: number
  gracePeriodDays?: number
  estimatedLateFee?: string | number
  reminderDaysBefore?: number[]
}

export interface RegisterCommitmentResult {
  commitmentId: string
  name: string
  dueDayOfMonth: number
  billingPeriod: string
  dueDate: string
}

export class RegisterCommitmentUseCase {
  constructor(private readonly sentinelRepo: ISentinelRepository) {}

  public async execute(command: RegisterCommitmentCommand): Promise<RegisterCommitmentResult> {
    const currency = command.currency || 'DOP'
    const expectedAmount = command.expectedAmount
      ? Money.parse(command.expectedAmount, currency)
      : null
    const estimatedLateFee = command.estimatedLateFee
      ? Money.parse(command.estimatedLateFee, currency)
      : Money.zero(currency)

    const commitment = RecurringCommitment.create({
      householdId: command.householdId,
      name: command.name,
      categoryId: command.categoryId,
      expectedAmount,
      currency,
      dueDayOfMonth: command.dueDayOfMonth,
      gracePeriodDays: command.gracePeriodDays ?? 0,
      estimatedLateFee,
      reminderDaysBefore: command.reminderDaysBefore ?? [5, 2, 0],
    })

    // 1. Guardar el compromiso recurrente
    await this.sentinelRepo.saveCommitment(commitment)

    // 2. Primar automáticamente el ciclo del mes actual para monitoreo inmediato
    const now = new Date()
    const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const cycle = await this.sentinelRepo.findOrCreateCycle(commitment, currentPeriod)

    return {
      commitmentId: commitment.getId(),
      name: commitment.getName(),
      dueDayOfMonth: commitment.getDueDayOfMonth(),
      billingPeriod: cycle.getBillingPeriod(),
      dueDate: cycle.getDueDate().toISOString().split('T')[0],
    }
  }
}
