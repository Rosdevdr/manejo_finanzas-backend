// ==============================================================================
// 🛡️ AUREUS · DOMAIN ENTITY: COMMITMENT CYCLE (CICLO MENSUAL DE VENCIMIENTO)
// ==============================================================================

import { DomainError } from '../../../../shared/domain/errors/domain.error.js'
import type { Money } from '../../../../shared/domain/value-objects/money.vo.js'

export type CycleStatus = 'pending' | 'paid' | 'overdue' | 'dismissed'

export class InvalidCycleError extends DomainError {
  constructor(message: string) {
    super(`[CommitmentCycle] ${message}`)
  }
}

export interface CreateCommitmentCycleProps {
  id?: string
  commitmentId: string
  householdId: string
  billingPeriod: string // 'YYYY-MM'
  dueDate: Date
  actualAmount?: Money | null
  createdAt?: Date
}

export interface ReconstituteCommitmentCycleProps {
  id: string
  commitmentId: string
  householdId: string
  billingPeriod: string
  dueDate: Date
  status: CycleStatus
  actualAmount: Money | null
  paidEntryId: string | null
  paidAt: Date | null
  alertsSentCount: number
  lastAlertAt: Date | null
  createdAt: Date
}

export class CommitmentCycle {
  private readonly id: string
  private readonly commitmentId: string
  private readonly householdId: string
  private readonly billingPeriod: string
  private readonly dueDate: Date
  private status: CycleStatus
  private actualAmount: Money | null
  private paidEntryId: string | null
  private paidAt: Date | null
  private alertsSentCount: number
  private lastAlertAt: Date | null
  private readonly createdAt: Date

  private constructor(props: ReconstituteCommitmentCycleProps) {
    if (!props.id) throw new InvalidCycleError('El ID del ciclo es requerido')
    if (!props.commitmentId) throw new InvalidCycleError('commitmentId es requerido')
    if (!props.householdId) throw new InvalidCycleError('householdId es requerido')
    if (!props.billingPeriod) throw new InvalidCycleError('billingPeriod es requerido')

    this.id = props.id
    this.commitmentId = props.commitmentId
    this.householdId = props.householdId
    this.billingPeriod = props.billingPeriod
    this.dueDate = props.dueDate
    this.status = props.status
    this.actualAmount = props.actualAmount
    this.paidEntryId = props.paidEntryId
    this.paidAt = props.paidAt
    this.alertsSentCount = props.alertsSentCount
    this.lastAlertAt = props.lastAlertAt
    this.createdAt = props.createdAt
  }

  public static create(props: CreateCommitmentCycleProps): CommitmentCycle {
    return new CommitmentCycle({
      id: props.id || crypto.randomUUID(),
      commitmentId: props.commitmentId,
      householdId: props.householdId,
      billingPeriod: props.billingPeriod,
      dueDate: props.dueDate,
      status: 'pending',
      actualAmount: props.actualAmount ?? null,
      paidEntryId: null,
      paidAt: null,
      alertsSentCount: 0,
      lastAlertAt: null,
      createdAt: props.createdAt ?? new Date(),
    })
  }

  public static reconstitute(props: ReconstituteCommitmentCycleProps): CommitmentCycle {
    return new CommitmentCycle(props)
  }

  // --- Transiciones ---

  public markPaid(entryId: string, amount: Money, paidAt: Date = new Date()): void {
    if (this.status === 'paid') {
      throw new InvalidCycleError('El ciclo ya está marcado como pagado')
    }
    this.status = 'paid'
    this.paidEntryId = entryId
    this.actualAmount = amount
    this.paidAt = paidAt
  }

  public recordAlertSent(alertDate: Date = new Date()): void {
    this.alertsSentCount += 1
    this.lastAlertAt = alertDate
  }

  public checkOverdue(currentDate: Date = new Date()): void {
    if (this.status === 'pending' && currentDate > this.dueDate) {
      this.status = 'overdue'
    }
  }

  public dismiss(): void {
    this.status = 'dismissed'
  }

  // --- Getters ---
  public getId(): string { return this.id }
  public getCommitmentId(): string { return this.commitmentId }
  public getHouseholdId(): string { return this.householdId }
  public getBillingPeriod(): string { return this.billingPeriod }
  public getDueDate(): Date { return this.dueDate }
  public getStatus(): CycleStatus { return this.status }
  public getActualAmount(): Money | null { return this.actualAmount }
  public getPaidEntryId(): string | null { return this.paidEntryId }
  public getPaidAt(): Date | null { return this.paidAt }
  public getAlertsSentCount(): number { return this.alertsSentCount }
  public getLastAlertAt(): Date | null { return this.lastAlertAt }
  public getCreatedAt(): Date { return this.createdAt }
}
