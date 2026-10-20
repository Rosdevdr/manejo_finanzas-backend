// ==============================================================================
// 🏛️ AUREUS · DOMAIN ENTITY: LEDGER ENTRY (ASIENTO CONTABLE INMUTABLE)
// ==============================================================================

import { Money } from '../../../../shared/domain/value-objects/money.vo.js'
import { DomainError } from '../../../../shared/domain/errors/domain.error.js'

export type LedgerKind = 'expense' | 'income' | 'reversal'

export class InvalidLedgerEntryError extends DomainError {
  constructor(message: string) {
    super(`[LedgerEntry] ${message}`)
  }
}

export interface CreateExpenseProps {
  id?: string
  householdId: string
  userId: string
  sourceEventId?: string | null
  sourceLine?: number
  amount: Money
  description: string
  transactedAt?: Date
  createdAt?: Date
}

export interface CreateIncomeProps {
  id?: string
  householdId: string
  userId: string
  sourceEventId?: string | null
  sourceLine?: number
  amount: Money
  description: string
  transactedAt?: Date
  createdAt?: Date
}

export interface CreateReversalProps {
  id?: string
  originalEntry: LedgerEntry
  userId: string
  sourceEventId?: string | null
  sourceLine?: number
  description?: string
  transactedAt?: Date
  createdAt?: Date
}

export interface ReconstituteLedgerEntryProps {
  id: string
  householdId: string
  userId: string
  sourceEventId: string | null
  sourceLine: number
  kind: LedgerKind
  reversesId: string | null
  amount: Money
  description: string
  transactedAt: Date
  createdAt: Date
}

export class LedgerEntry {
  private readonly id: string
  private readonly householdId: string
  private readonly userId: string
  private readonly sourceEventId: string | null
  private readonly sourceLine: number
  private readonly kind: LedgerKind
  private readonly reversesId: string | null
  private readonly amount: Money
  private readonly description: string
  private readonly transactedAt: Date
  private readonly createdAt: Date

  private constructor(props: ReconstituteLedgerEntryProps) {
    this.validate(props)

    this.id = props.id
    this.householdId = props.householdId
    this.userId = props.userId
    this.sourceEventId = props.sourceEventId
    this.sourceLine = props.sourceLine
    this.kind = props.kind
    this.reversesId = props.reversesId
    this.amount = props.amount
    this.description = props.description.trim()
    this.transactedAt = props.transactedAt
    this.createdAt = props.createdAt
  }

  /**
   * Fábrica para crear un nuevo asiento de gasto (Expense).
   */
  public static createExpense(props: CreateExpenseProps): LedgerEntry {
    return new LedgerEntry({
      id: props.id || crypto.randomUUID(),
      householdId: props.householdId,
      userId: props.userId,
      sourceEventId: props.sourceEventId ?? null,
      sourceLine: props.sourceLine ?? 1,
      kind: 'expense',
      reversesId: null,
      amount: props.amount,
      description: props.description,
      transactedAt: props.transactedAt ?? new Date(),
      createdAt: props.createdAt ?? new Date(),
    })
  }

  /**
   * Fábrica para crear un nuevo asiento de ingreso (Income).
   */
  public static createIncome(props: CreateIncomeProps): LedgerEntry {
    return new LedgerEntry({
      id: props.id || crypto.randomUUID(),
      householdId: props.householdId,
      userId: props.userId,
      sourceEventId: props.sourceEventId ?? null,
      sourceLine: props.sourceLine ?? 1,
      kind: 'income',
      reversesId: null,
      amount: props.amount,
      description: props.description,
      transactedAt: props.transactedAt ?? new Date(),
      createdAt: props.createdAt ?? new Date(),
    })
  }

  /**
   * Fábrica para crear una Reversión Total de un asiento existente.
   * Reglas estrictas:
   * 1. No se puede revertir una reversión.
   * 2. El monto, la moneda y el hogar deben coincidir exactamente con el original.
   */
  public static createReversal(props: CreateReversalProps): LedgerEntry {
    const { originalEntry } = props

    if (originalEntry.getKind() === 'reversal') {
      throw new InvalidLedgerEntryError('No es posible revertir una entrada que ya es una reversión.')
    }

    return new LedgerEntry({
      id: props.id || crypto.randomUUID(),
      householdId: originalEntry.getHouseholdId(),
      userId: props.userId,
      sourceEventId: props.sourceEventId ?? null,
      sourceLine: props.sourceLine ?? 1,
      kind: 'reversal',
      reversesId: originalEntry.getId(),
      amount: originalEntry.getAmount(), // Reversión siempre 100% total
      description: props.description ?? `Reversión total de: ${originalEntry.getDescription()}`,
      transactedAt: props.transactedAt ?? new Date(),
      createdAt: props.createdAt ?? new Date(),
    })
  }

  /**
   * Reconstituye una entidad desde la base de datos (hidratación).
   */
  public static reconstitute(props: ReconstituteLedgerEntryProps): LedgerEntry {
    return new LedgerEntry(props)
  }

  // --- Getters ---
  public getId(): string { return this.id }
  public getHouseholdId(): string { return this.householdId }
  public getUserId(): string { return this.userId }
  public getSourceEventId(): string | null { return this.sourceEventId }
  public getSourceLine(): number { return this.sourceLine }
  public getKind(): LedgerKind { return this.kind }
  public getReversesId(): string | null { return this.reversesId }
  public getAmount(): Money { return this.amount }
  public getDescription(): string { return this.description }
  public getTransactedAt(): Date { return this.transactedAt }
  public getCreatedAt(): Date { return this.createdAt }

  // --- Validaciones de Dominio ---
  private validate(props: ReconstituteLedgerEntryProps): void {
    if (!props.id) {
      throw new InvalidLedgerEntryError('El ID de la entrada es requerido.')
    }
    if (!props.householdId) {
      throw new InvalidLedgerEntryError('El householdId es requerido.')
    }
    if (!props.userId) {
      throw new InvalidLedgerEntryError('El userId es requerido.')
    }
    if (!props.description || props.description.trim().length === 0) {
      throw new InvalidLedgerEntryError('La descripción no puede estar vacía.')
    }
    if (!props.amount || !props.amount.isPositive()) {
      throw new InvalidLedgerEntryError('El monto de la entrada debe ser un valor positivo.')
    }
    if (!Number.isInteger(props.sourceLine) || props.sourceLine < 1) {
      throw new InvalidLedgerEntryError('sourceLine debe ser un número entero mayor o igual a 1.')
    }

    if (props.kind === 'reversal') {
      if (!props.reversesId) {
        throw new InvalidLedgerEntryError('Una entrada de tipo reversal debe incluir obligatoriamente el reversesId.')
      }
    } else {
      if (props.reversesId !== null) {
        throw new InvalidLedgerEntryError('Solo las entradas de tipo reversal pueden tener un reversesId asociado.')
      }
    }
  }
}
