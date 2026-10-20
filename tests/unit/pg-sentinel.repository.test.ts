import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgSentinelRepository } from '../../src/modules/sentinel/infrastructure/persistence/pg-sentinel.repository.js'
import { RecurringCommitment } from '../../src/modules/sentinel/domain/entities/recurring-commitment.entity.js'
import { CommitmentCycle } from '../../src/modules/sentinel/domain/entities/commitment-cycle.entity.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'

describe('PgSentinelRepository', () => {
  let mockClient: any
  let repo: PgSentinelRepository

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    }
    repo = new PgSentinelRepository()
    Object.defineProperty(repo, 'client', {
      get: () => mockClient,
      configurable: true,
    })
  })

  it('guarda un compromiso con ON CONFLICT en recurring_commitments', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] })

    const commitment = RecurringCommitment.create({
      id: 'comm-1',
      householdId: 'h-1',
      name: 'Internet Altice',
      expectedAmount: Money.parse('1899.00', 'DOP'),
      dueDayOfMonth: 15,
      estimatedLateFee: Money.parse('300.00', 'DOP'),
    })

    await repo.saveCommitment(commitment)

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO recurring_commitments'),
      expect.arrayContaining(['comm-1', 'h-1', 'Internet Altice'])
    )
  })

  it('busca un compromiso por ID y reconstituye la entidad con Money VOs', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'comm-1',
          household_id: 'h-1',
          name: 'Luz Edesur',
          category_id: null,
          expected_amount_cents: '250000',
          currency: 'DOP',
          frequency: 'monthly',
          due_day_of_month: 20,
          grace_period_days: 0,
          estimated_late_fee_cents: '50000',
          reminder_days_before: [5, 2, 0],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    })

    const result = await repo.findCommitmentById('comm-1')

    expect(result).not.toBeNull()
    expect(result!.getName()).toBe('Luz Edesur')
    expect(result!.getExpectedAmount()?.format()).toBe('DOP $2,500.00')
    expect(result!.getEstimatedLateFee().format()).toBe('DOP $500.00')
  })

  it('lista compromisos activos ordenados por día de vencimiento', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'comm-1',
          household_id: 'h-1',
          name: 'Tarjeta Banreservas',
          category_id: null,
          expected_amount_cents: null,
          currency: 'DOP',
          frequency: 'monthly',
          due_day_of_month: 5,
          grace_period_days: 3,
          estimated_late_fee_cents: '80000',
          reminder_days_before: [3, 1, 0],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    })

    const list = await repo.listActiveCommitments('h-1')

    expect(list).toHaveLength(1)
    expect(list[0].getName()).toBe('Tarjeta Banreservas')
  })

  it('actualiza el estado de un ciclo en commitment_cycles', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] })

    const cycle = CommitmentCycle.create({
      id: 'cycle-1',
      commitmentId: 'comm-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate: new Date(),
    })
    cycle.markPaid('entry-1', Money.parse('1500.00', 'DOP'))

    await repo.updateCycle(cycle)

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE commitment_cycles'),
      expect.arrayContaining(['paid', '150000', 'entry-1', 'cycle-1'])
    )
  })
})
