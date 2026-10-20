// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: POSTGRESQL LEDGER REPOSITORY
// ==============================================================================

import type pg from 'pg'
import type { ILedgerRepository, ListLedgerOptions } from '../../domain/ports/ledger-repository.port.js'
import { LedgerEntry, type LedgerKind } from '../../domain/entities/ledger-entry.entity.js'
import { Money, type SupportedCurrency } from '../../../../shared/domain/value-objects/money.vo.js'
import { getDbExecutor } from '../../../../shared/infrastructure/persistence/unit-of-work.js'
import { getDbPool } from '../../../../shared/infrastructure/persistence/postgres.pool.js'

interface LedgerRow {
  id: string
  household_id: string
  user_id: string
  source_event_id: string | null
  source_line: number
  kind: LedgerKind
  reverses_id: string | null
  amount_cents: string | number // BIGINT puede llegar como string en pg
  currency: SupportedCurrency
  description: string
  transacted_at: Date
  created_at: Date
}

export class PgLedgerRepository implements ILedgerRepository {
  constructor(private readonly pool: pg.Pool = getDbPool()) {}

  public async append(entry: LedgerEntry): Promise<void> {
    const executor = getDbExecutor(this.pool)

    const query = `
      INSERT INTO ledger_entries (
        id, household_id, user_id, source_event_id, source_line,
        kind, reverses_id, amount_cents, currency, description,
        transacted_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `

    const values = [
      entry.getId(),
      entry.getHouseholdId(),
      entry.getUserId(),
      entry.getSourceEventId(),
      entry.getSourceLine(),
      entry.getKind(),
      entry.getReversesId(),
      entry.getAmount().getCents(),
      entry.getAmount().getCurrency(),
      entry.getDescription(),
      entry.getTransactedAt(),
      entry.getCreatedAt(),
    ]

    await executor.query(query, values)
  }

  public async appendBatch(entries: LedgerEntry[]): Promise<void> {
    if (entries.length === 0) return

    const executor = getDbExecutor(this.pool)

    for (const entry of entries) {
      await this.append(entry)
    }
  }

  public async findById(id: string): Promise<LedgerEntry | null> {
    const executor = getDbExecutor(this.pool)

    const query = `
      SELECT id, household_id, user_id, source_event_id, source_line,
             kind, reverses_id, amount_cents, currency, description,
             transacted_at, created_at
      FROM ledger_entries
      WHERE id = $1
    `

    const res = await executor.query<LedgerRow>(query, [id])
    if (res.rows.length === 0) return null

    return this.mapToEntity(res.rows[0])
  }

  public async findBySourceEvent(sourceEventId: string): Promise<LedgerEntry[]> {
    const executor = getDbExecutor(this.pool)

    const query = `
      SELECT id, household_id, user_id, source_event_id, source_line,
             kind, reverses_id, amount_cents, currency, description,
             transacted_at, created_at
      FROM ledger_entries
      WHERE source_event_id = $1
      ORDER BY source_line ASC
    `

    const res = await executor.query<LedgerRow>(query, [sourceEventId])
    return res.rows.map(row => this.mapToEntity(row))
  }

  public async findReversalOf(originalEntryId: string): Promise<LedgerEntry | null> {
    const executor = getDbExecutor(this.pool)

    const query = `
      SELECT id, household_id, user_id, source_event_id, source_line,
             kind, reverses_id, amount_cents, currency, description,
             transacted_at, created_at
      FROM ledger_entries
      WHERE reverses_id = $1 AND kind = 'reversal'
      LIMIT 1
    `

    const res = await executor.query<LedgerRow>(query, [originalEntryId])
    if (res.rows.length === 0) return null

    return this.mapToEntity(res.rows[0])
  }

  public async listByHousehold(householdId: string, options?: ListLedgerOptions): Promise<LedgerEntry[]> {
    const executor = getDbExecutor(this.pool)

    const conditions: string[] = ['household_id = $1']
    const params: unknown[] = [householdId]
    let paramIndex = 2

    if (options?.from) {
      conditions.push(`transacted_at >= $${paramIndex++}`)
      params.push(options.from)
    }

    if (options?.to) {
      conditions.push(`transacted_at <= $${paramIndex++}`)
      params.push(options.to)
    }

    let query = `
      SELECT id, household_id, user_id, source_event_id, source_line,
             kind, reverses_id, amount_cents, currency, description,
             transacted_at, created_at
      FROM ledger_entries
      WHERE ${conditions.join(' AND ')}
      ORDER BY transacted_at DESC
    `

    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`
      params.push(options.limit)
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex++}`
      params.push(options.offset)
    }

    const res = await executor.query<LedgerRow>(query, params)
    return res.rows.map(row => this.mapToEntity(row))
  }

  private mapToEntity(row: LedgerRow): LedgerEntry {
    const cents = typeof row.amount_cents === 'string' ? parseInt(row.amount_cents, 10) : row.amount_cents
    const money = Money.fromCents(cents, row.currency)

    return LedgerEntry.reconstitute({
      id: row.id,
      householdId: row.household_id,
      userId: row.user_id,
      sourceEventId: row.source_event_id,
      sourceLine: row.source_line,
      kind: row.kind,
      reversesId: row.reverses_id,
      amount: money,
      description: row.description,
      transactedAt: new Date(row.transacted_at),
      createdAt: new Date(row.created_at),
    })
  }
}
