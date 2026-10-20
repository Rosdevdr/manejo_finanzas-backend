// ==============================================================================
// 🛡️ AUREUS · DOMAIN ENTITY: RECURRING COMMITMENT (FACTURA O COMPROMISO PERIÓDICO)
// ==============================================================================

import { DomainError } from '../../../../shared/domain/errors/domain.error.js'
import { Money, type SupportedCurrency } from '../../../../shared/domain/value-objects/money.vo.js'

export type CommitmentFrequency = 'monthly' | 'biweekly' | 'weekly' | 'yearly'

export class InvalidCommitmentError extends DomainError {
  constructor(message: string) {
    super(`[RecurringCommitment] ${message}`)
  }
}

export interface CreateRecurringCommitmentProps {
  id?: string
  householdId: string
  name: string
  categoryId?: string | null
  expectedAmount?: Money | null
  currency?: SupportedCurrency
  frequency?: CommitmentFrequency
  dueDayOfMonth: number
  gracePeriodDays?: number
  estimatedLateFee?: Money | null
  reminderDaysBefore?: number[]
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface ReconstituteRecurringCommitmentProps {
  id: string
  householdId: string
  name: string
  categoryId: string | null
  expectedAmount: Money | null
  currency: SupportedCurrency
  frequency: CommitmentFrequency
  dueDayOfMonth: number
  gracePeriodDays: number
  estimatedLateFee: Money
  reminderDaysBefore: number[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class RecurringCommitment {
  private readonly id: string
  private readonly householdId: string
  private name: string
  private categoryId: string | null
  private expectedAmount: Money | null
  private readonly currency: SupportedCurrency
  private frequency: CommitmentFrequency
  private dueDayOfMonth: number
  private gracePeriodDays: number
  private estimatedLateFee: Money
  private reminderDaysBefore: number[]
  private isActive: boolean
  private readonly createdAt: Date
  private updatedAt: Date

  private constructor(props: ReconstituteRecurringCommitmentProps) {
    if (!props.id) throw new InvalidCommitmentError('El ID es requerido')
    if (!props.householdId) throw new InvalidCommitmentError('householdId es requerido')
    if (!props.name || props.name.trim().length === 0) {
      throw new InvalidCommitmentError('El nombre del compromiso es requerido')
    }
    if (props.dueDayOfMonth < 1 || props.dueDayOfMonth > 31) {
      throw new InvalidCommitmentError('El día de vencimiento debe estar entre 1 y 31')
    }

    this.id = props.id
    this.householdId = props.householdId
    this.name = props.name.trim()
    this.categoryId = props.categoryId
    this.expectedAmount = props.expectedAmount
    this.currency = props.currency
    this.frequency = props.frequency
    this.dueDayOfMonth = props.dueDayOfMonth
    this.gracePeriodDays = props.gracePeriodDays
    this.estimatedLateFee = props.estimatedLateFee
    this.reminderDaysBefore = props.reminderDaysBefore
    this.isActive = props.isActive
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  public static create(props: CreateRecurringCommitmentProps): RecurringCommitment {
    const currency = props.currency || props.expectedAmount?.getCurrency() || 'DOP'
    const id = props.id || crypto.randomUUID()
    const now = new Date()

    return new RecurringCommitment({
      id,
      householdId: props.householdId,
      name: props.name,
      categoryId: props.categoryId ?? null,
      expectedAmount: props.expectedAmount ?? null,
      currency,
      frequency: props.frequency ?? 'monthly',
      dueDayOfMonth: props.dueDayOfMonth,
      gracePeriodDays: props.gracePeriodDays ?? 0,
      estimatedLateFee: props.estimatedLateFee ?? Money.zero(currency),
      reminderDaysBefore: props.reminderDaysBefore ?? [5, 2, 0],
      isActive: props.isActive ?? true,
      createdAt: props.createdAt ?? now,
      updatedAt: props.updatedAt ?? now,
    })
  }

  public static reconstitute(props: ReconstituteRecurringCommitmentProps): RecurringCommitment {
    return new RecurringCommitment(props)
  }

  /**
   * Calcula la fecha de vencimiento exacta para un año y mes específicos (ej: 2026-10).
   * Ajusta automáticamente si el mes tiene menos días (ej: 31 de febrero -> 28 de febrero).
   */
  public calculateDueDateForPeriod(year: number, month1Indexed: number): Date {
    const lastDayOfMonth = new Date(year, month1Indexed, 0).getDate()
    const effectiveDay = Math.min(this.dueDayOfMonth, lastDayOfMonth)
    return new Date(Date.UTC(year, month1Indexed - 1, effectiveDay, 23, 59, 59))
  }

  /**
   * Determina si hoy corresponde enviar una alerta preventiva para el vencimiento dado.
   */
  public shouldAlertToday(today: Date, dueDate: Date): { alert: boolean; daysRemaining: number } {
    const msPerDay = 1000 * 60 * 60 * 24
    // Comparación basada en UTC medianoche
    const todayZero = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const dueZero = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())
    const diffDays = Math.round((dueZero - todayZero) / msPerDay)

    const shouldAlert = this.reminderDaysBefore.includes(diffDays)
    return { alert: shouldAlert, daysRemaining: diffDays }
  }

  // --- Getters & Modificadores ---
  public getId(): string { return this.id }
  public getHouseholdId(): string { return this.householdId }
  public getName(): string { return this.name }
  public getCategoryId(): string | null { return this.categoryId }
  public getExpectedAmount(): Money | null { return this.expectedAmount }
  public getCurrency(): SupportedCurrency { return this.currency }
  public getFrequency(): CommitmentFrequency { return this.frequency }
  public getDueDayOfMonth(): number { return this.dueDayOfMonth }
  public getGracePeriodDays(): number { return this.gracePeriodDays }
  public getEstimatedLateFee(): Money { return this.estimatedLateFee }
  public getReminderDaysBefore(): number[] { return [...this.reminderDaysBefore] }
  public getIsActive(): boolean { return this.isActive }
  public getCreatedAt(): Date { return this.createdAt }
  public getUpdatedAt(): Date { return this.updatedAt }

  public deactivate(): void {
    this.isActive = false
    this.updatedAt = new Date()
  }

  public activate(): void {
    this.isActive = true
    this.updatedAt = new Date()
  }
}
