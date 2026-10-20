// ==============================================================================
// 🛡️ AUREUS · INFRASTRUCTURE: POSTGRESQL SENTINEL REPOSITORY
// ==============================================================================

import type pg from 'pg'
import type { ISentinelRepository, CommitmentWithCycle } from '../../domain/ports/sentinel-repository.port.js'
import {
  RecurringCommitment,
  type CommitmentFrequency,
} from '../../domain/entities/recurring-commitment.entity.js'
import {
  CommitmentCycle,
  type CycleStatus,
} from '../../domain/entities/commitment-cycle.entity.js'
import { Money, type SupportedCurrency } from '../../../../shared/domain/value-objects/money.vo.js'
import { getDbExecutor } from '../../../../shared/infrastructure/persistence/unit-of-work.js'
import { getDbPool } from '../../../../shared/infrastructure/persistence/postgres.pool.js'

interface CommitmentRow {
  id: string
  household_id: string
  name: string
  category_id: string | null
  expected_amount_cents: string | null
  currency: SupportedCurrency
  frequency: CommitmentFrequency
  due_day_of_month: number
  grace_period_days: number
  estimated_late_fee_cents: string
  reminder_days_before: number[]
  is_active: boolean
  created_at: Date
  updated_at: Date
}

interface CycleRow {
  id: string
  commitment_id: string
  household_id: string
  billing_period: string
  due_date: Date
  status: CycleStatus
  actual_amount_cents: string | null
  paid_entry_id: string | null
  paid_at: Date | null
  alerts_sent_count: number
  last_alert_at: Date | null
  created_at: Date
}

export class PgSentinelRepository implements ISentinelRepository {
  private get client(): pg.Pool | pg.PoolClient {
    return getDbExecutor() || getDbPool()
  }

  public async saveCommitment(commitment: RecurringCommitment): Promise<void> {
    const query = `
      INSERT INTO recurring_commitments (
        id, household_id, name, category_id, expected_amount_cents,
        currency, frequency, due_day_of_month, grace_period_days,
        estimated_late_fee_cents, reminder_days_before, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category_id = EXCLUDED.category_id,
        expected_amount_cents = EXCLUDED.expected_amount_cents,
        due_day_of_month = EXCLUDED.due_day_of_month,
        grace_period_days = EXCLUDED.grace_period_days,
        estimated_late_fee_cents = EXCLUDED.estimated_late_fee_cents,
        reminder_days_before = EXCLUDED.reminder_days_before,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `

    const values = [
      commitment.getId(),
      commitment.getHouseholdId(),
      commitment.getName(),
      commitment.getCategoryId(),
      commitment.getExpectedAmount() ? commitment.getExpectedAmount()!.getCents().toString() : null,
      commitment.getCurrency(),
      commitment.getFrequency(),
      commitment.getDueDayOfMonth(),
      commitment.getGracePeriodDays(),
      commitment.getEstimatedLateFee().getCents().toString(),
      commitment.getReminderDaysBefore(),
      commitment.getIsActive(),
      commitment.getCreatedAt(),
      commitment.getUpdatedAt(),
    ]

    await this.client.query(query, values)
  }

  public async findCommitmentById(id: string): Promise<RecurringCommitment | null> {
    const res = await this.client.query('SELECT * FROM recurring_commitments WHERE id = $1 LIMIT 1', [id])
    if (res.rows.length === 0) return null
    return this.mapCommitmentRow(res.rows[0])
  }

  public async listActiveCommitments(householdId: string): Promise<RecurringCommitment[]> {
    const query = `
      SELECT * FROM recurring_commitments
      WHERE household_id = $1 AND is_active = true
      ORDER BY due_day_of_month ASC;
    `
    const res = await this.client.query(query, [householdId])
    return res.rows.map(r => this.mapCommitmentRow(r))
  }

  public async findCycleByCommitmentAndPeriod(
    commitmentId: string,
    billingPeriod: string
  ): Promise<CommitmentCycle | null> {
    const query = `
      SELECT * FROM commitment_cycles
      WHERE commitment_id = $1 AND billing_period = $2
      LIMIT 1;
    `
    const res = await this.client.query(query, [commitmentId, billingPeriod])
    if (res.rows.length === 0) return null
    return this.mapCycleRow(res.rows[0])
  }

  public async findOrCreateCycle(
    commitment: RecurringCommitment,
    billingPeriod: string
  ): Promise<CommitmentCycle> {
    const existing = await this.findCycleByCommitmentAndPeriod(commitment.getId(), billingPeriod)
    if (existing) return existing

    const [yearStr, monthStr] = billingPeriod.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const dueDate = commitment.calculateDueDateForPeriod(year, month)

    const insertQuery = `
      INSERT INTO commitment_cycles (
        commitment_id, household_id, billing_period, due_date, status
      ) VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (commitment_id, billing_period) DO NOTHING
      RETURNING *;
    `

    const res = await this.client.query(insertQuery, [
      commitment.getId(),
      commitment.getHouseholdId(),
      billingPeriod,
      dueDate,
    ])

    if (res.rows.length > 0) {
      return this.mapCycleRow(res.rows[0])
    }

    // Si hubo conflicto concurrente, obtenemos el existente
    return (await this.findCycleByCommitmentAndPeriod(commitment.getId(), billingPeriod))!
  }

  public async listPendingCyclesForScan(
    asOfDate: Date,
    horizonDays: number = 7
  ): Promise<CommitmentWithCycle[]> {
    const horizonDate = new Date(asOfDate.getTime() + horizonDays * 24 * 60 * 60 * 1000)

    const query = `
      SELECT 
        c.id as cycle_id, c.commitment_id, c.household_id as cycle_household_id,
        c.billing_period, c.due_date, c.status as cycle_status,
        c.actual_amount_cents, c.paid_entry_id, c.paid_at,
        c.alerts_sent_count, c.last_alert_at, c.created_at as cycle_created_at,
        rc.id as commitment_id, rc.household_id as commitment_household_id,
        rc.name, rc.category_id, rc.expected_amount_cents,
        rc.currency, rc.frequency, rc.due_day_of_month,
        rc.grace_period_days, rc.estimated_late_fee_cents,
        rc.reminder_days_before, rc.is_active,
        rc.created_at as commitment_created_at, rc.updated_at as commitment_updated_at
      FROM commitment_cycles c
      JOIN recurring_commitments rc ON rc.id = c.commitment_id
      WHERE rc.is_active = true
        AND c.status IN ('pending', 'overdue')
        AND c.due_date <= $1
      ORDER BY c.due_date ASC;
    `

    const res = await this.client.query(query, [horizonDate])

    return res.rows.map((row: any) => {
      const commitment = RecurringCommitment.reconstitute({
        id: row.commitment_id,
        householdId: row.commitment_household_id,
        name: row.name,
        categoryId: row.category_id,
        expectedAmount: row.expected_amount_cents
          ? Money.create(BigInt(row.expected_amount_cents), row.currency)
          : null,
        currency: row.currency,
        frequency: row.frequency,
        dueDayOfMonth: row.due_day_of_month,
        gracePeriodDays: row.grace_period_days,
        estimatedLateFee: Money.create(BigInt(row.estimated_late_fee_cents || 0), row.currency),
        reminderDaysBefore: row.reminder_days_before,
        isActive: row.is_active,
        createdAt: row.commitment_created_at,
        updatedAt: row.commitment_updated_at,
      })

      const cycle = CommitmentCycle.reconstitute({
        id: row.cycle_id,
        commitmentId: row.commitment_id,
        householdId: row.cycle_household_id,
        billingPeriod: row.billing_period,
        dueDate: row.due_date,
        status: row.cycle_status,
        actualAmount: row.actual_amount_cents
          ? Money.create(BigInt(row.actual_amount_cents), row.currency)
          : null,
        paidEntryId: row.paid_entry_id,
        paidAt: row.paid_at,
        alertsSentCount: row.alerts_sent_count,
        lastAlertAt: row.last_alert_at,
        createdAt: row.cycle_created_at,
      })

      return { commitment, cycle }
    })
  }

  public async updateCycle(cycle: CommitmentCycle): Promise<void> {
    const query = `
      UPDATE commitment_cycles
      SET 
        status = $1,
        actual_amount_cents = $2,
        paid_entry_id = $3,
        paid_at = $4,
        alerts_sent_count = $5,
        last_alert_at = $6
      WHERE id = $7;
    `

    const values = [
      cycle.getStatus(),
      cycle.getActualAmount() ? cycle.getActualAmount()!.getCents().toString() : null,
      cycle.getPaidEntryId(),
      cycle.getPaidAt(),
      cycle.getAlertsSentCount(),
      cycle.getLastAlertAt(),
      cycle.getId(),
    ]

    await this.client.query(query, values)
  }

  public async findPendingCycleByTerms(
    householdId: string,
    billingPeriod: string,
    searchTerms: string[]
  ): Promise<CommitmentWithCycle | null> {
    if (searchTerms.length === 0) return null

    // Buscamos coincidencia parcial por LIKE en el nombre del compromiso
    const conditions = searchTerms.map((_, idx) => `rc.name ILIKE $${idx + 3}`).join(' OR ')
    const query = `
      SELECT 
        c.id as cycle_id, c.commitment_id, c.household_id as cycle_household_id,
        c.billing_period, c.due_date, c.status as cycle_status,
        c.actual_amount_cents, c.paid_entry_id, c.paid_at,
        c.alerts_sent_count, c.last_alert_at, c.created_at as cycle_created_at,
        rc.id as commitment_id, rc.household_id as commitment_household_id,
        rc.name, rc.category_id, rc.expected_amount_cents,
        rc.currency, rc.frequency, rc.due_day_of_month,
        rc.grace_period_days, rc.estimated_late_fee_cents,
        rc.reminder_days_before, rc.is_active,
        rc.created_at as commitment_created_at, rc.updated_at as commitment_updated_at
      FROM commitment_cycles c
      JOIN recurring_commitments rc ON rc.id = c.commitment_id
      WHERE c.household_id = $1
        AND c.billing_period = $2
        AND c.status IN ('pending', 'overdue')
        AND (${conditions})
      LIMIT 1;
    `

    const params = [householdId, billingPeriod, ...searchTerms.map(t => `%${t}%`)]
    const res = await this.client.query(query, params)
    if (res.rows.length === 0) return null

    const row = res.rows[0]
    const commitment = RecurringCommitment.reconstitute({
      id: row.commitment_id,
      householdId: row.commitment_household_id,
      name: row.name,
      categoryId: row.category_id,
      expectedAmount: row.expected_amount_cents
        ? Money.create(BigInt(row.expected_amount_cents), row.currency)
        : null,
      currency: row.currency,
      frequency: row.frequency,
      dueDayOfMonth: row.due_day_of_month,
      gracePeriodDays: row.grace_period_days,
      estimatedLateFee: Money.create(BigInt(row.estimated_late_fee_cents || 0), row.currency),
      reminderDaysBefore: row.reminder_days_before,
      isActive: row.is_active,
      createdAt: row.commitment_created_at,
      updatedAt: row.commitment_updated_at,
    })

    const cycle = CommitmentCycle.reconstitute({
      id: row.cycle_id,
      commitmentId: row.commitment_id,
      householdId: row.cycle_household_id,
      billingPeriod: row.billing_period,
      dueDate: row.due_date,
      status: row.cycle_status,
      actualAmount: row.actual_amount_cents
        ? Money.create(BigInt(row.actual_amount_cents), row.currency)
        : null,
      paidEntryId: row.paid_entry_id,
      paidAt: row.paid_at,
      alertsSentCount: row.alerts_sent_count,
      lastAlertAt: row.last_alert_at,
      createdAt: row.cycle_created_at,
    })

    return { commitment, cycle }
  }

  private mapCommitmentRow(row: CommitmentRow): RecurringCommitment {
    return RecurringCommitment.reconstitute({
      id: row.id,
      householdId: row.household_id,
      name: row.name,
      categoryId: row.category_id,
      expectedAmount: row.expected_amount_cents
        ? Money.create(BigInt(row.expected_amount_cents), row.currency)
        : null,
      currency: row.currency,
      frequency: row.frequency,
      dueDayOfMonth: row.due_day_of_month,
      gracePeriodDays: row.grace_period_days,
      estimatedLateFee: Money.create(BigInt(row.estimated_late_fee_cents || 0), row.currency),
      reminderDaysBefore: row.reminder_days_before,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  }

  private mapCycleRow(row: CycleRow): CommitmentCycle {
    return CommitmentCycle.reconstitute({
      id: row.id,
      commitmentId: row.commitment_id,
      householdId: row.household_id,
      billingPeriod: row.billing_period,
      dueDate: row.due_date,
      status: row.status,
      actualAmount: null,
      paidEntryId: row.paid_entry_id,
      paidAt: row.paid_at,
      alertsSentCount: row.alerts_sent_count,
      lastAlertAt: row.last_alert_at,
      createdAt: row.created_at,
    })
  }
}
