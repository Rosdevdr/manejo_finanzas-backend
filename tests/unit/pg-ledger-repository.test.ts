import { describe, it, expect, vi, beforeEach } from 'vitest'
import type pg from 'pg'
import { PgLedgerRepository } from '../../src/modules/ledger/infrastructure/persistence/pg-ledger.repository.js'
import { LedgerEntry } from '../../src/modules/ledger/domain/entities/ledger-entry.entity.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'
import { PgUnitOfWork } from '../../src/shared/infrastructure/persistence/unit-of-work.js'

describe('Infrastructure: PgLedgerRepository', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>
    release: ReturnType<typeof vi.fn>
  }
  let mockPool: {
    connect: ReturnType<typeof vi.fn>
    query: ReturnType<typeof vi.fn>
  }

  const dummyHouseholdId = '11111111-1111-4111-a111-111111111111'
  const dummyUserId = '22222222-2222-4222-a222-222222222222'

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    }
  })

  it('debe insertar una entrada con parámetros SQL limpios', async () => {
    const repo = new PgLedgerRepository(mockPool as unknown as pg.Pool)
    const entry = LedgerEntry.createExpense({
      householdId: dummyHouseholdId,
      userId: dummyUserId,
      amount: Money.parse('1200.50', 'DOP'),
      description: 'Combustible',
    })

    await repo.append(entry)

    expect(mockPool.query).toHaveBeenCalledTimes(1)
    const [sqlQuery, sqlParams] = mockPool.query.mock.calls[0]

    expect(sqlQuery).toContain('INSERT INTO ledger_entries')
    expect(sqlParams).toContain(entry.getId())
    expect(sqlParams).toContain(120050) // en centavos
    expect(sqlParams).toContain('DOP')
    expect(sqlParams).toContain('expense')
    expect(sqlParams).toContain('Combustible')
  })

  it('debe ejecutar la inserción en la conexión transaccional si está dentro de UnitOfWork', async () => {
    const pool = mockPool as unknown as pg.Pool
    const uow = new PgUnitOfWork(pool)
    const repo = new PgLedgerRepository(pool)

    const entry = LedgerEntry.createExpense({
      householdId: dummyHouseholdId,
      userId: dummyUserId,
      amount: Money.parse('300.00', 'DOP'),
      description: 'Café',
    })

    await uow.execute(async () => {
      await repo.append(entry)
    })

    // Debe haberse ejecutado en mockClient, NO en mockPool.query
    expect(mockPool.query).toHaveBeenCalledTimes(0)
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ledger_entries'), expect.any(Array))
  })

  it('debe mapear correctamente un resultado SQL a la entidad LedgerEntry en findById', async () => {
    const mockRow = {
      id: 'e1-uuid',
      household_id: dummyHouseholdId,
      user_id: dummyUserId,
      source_event_id: 'inbox-1',
      source_line: 1,
      kind: 'expense',
      reverses_id: null,
      amount_cents: '45000', // string de Postgres BIGINT
      currency: 'DOP',
      description: 'Cena',
      transacted_at: new Date('2026-10-20T12:00:00Z'),
      created_at: new Date('2026-10-20T12:00:00Z'),
    }

    mockPool.query.mockResolvedValueOnce({ rows: [mockRow] })

    const repo = new PgLedgerRepository(mockPool as unknown as pg.Pool)
    const found = await repo.findById('e1-uuid')

    expect(found).not.toBeNull()
    expect(found!.getId()).toBe('e1-uuid')
    expect(found!.getAmount().getCents()).toBe(45000)
    expect(found!.getAmount().toUnits()).toBe(450)
    expect(found!.getDescription()).toBe('Cena')
  })

  it('debe devolver null cuando la entrada no existe en findById', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const repo = new PgLedgerRepository(mockPool as unknown as pg.Pool)
    const found = await repo.findById('non-existent')

    expect(found).toBeNull()
  })
})
