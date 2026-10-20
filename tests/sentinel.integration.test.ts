import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { PgSentinelRepository } from '../src/modules/sentinel/infrastructure/persistence/pg-sentinel.repository.js'
import { RecurringCommitment } from '../src/modules/sentinel/domain/entities/recurring-commitment.entity.js'
import { CommitmentCycle } from '../src/modules/sentinel/domain/entities/commitment-cycle.entity.js'
import { Money } from '../src/shared/domain/value-objects/money.vo.js'

describe('Integration: /api/sentinel REST API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /api/sentinel/commitments debe retornar lista de compromisos con su ciclo activo', async () => {
    const mockCommitment = RecurringCommitment.create({
      id: 'comm-1',
      householdId: '11111111-1111-4111-a111-111111111111',
      name: 'Luz Edesur',
      expectedAmount: Money.parse('2500.00', 'DOP'),
      dueDayOfMonth: 20,
      estimatedLateFee: Money.parse('500.00', 'DOP'),
    })

    const mockCycle = CommitmentCycle.create({
      id: 'cycle-1',
      commitmentId: 'comm-1',
      householdId: '11111111-1111-4111-a111-111111111111',
      billingPeriod: '2026-10',
      dueDate: new Date(Date.UTC(2026, 9, 20)),
    })

    vi.spyOn(PgSentinelRepository.prototype, 'listActiveCommitments').mockResolvedValue([mockCommitment])
    vi.spyOn(PgSentinelRepository.prototype, 'findOrCreateCycle').mockResolvedValue(mockCycle)

    const res = await request(app).get('/api/sentinel/commitments')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.commitments).toHaveLength(1)
    expect(res.body.data.commitments[0].name).toBe('Luz Edesur')
    expect(res.body.data.commitments[0].currentCycle.status).toBe('pending')
  })

  it('POST /api/sentinel/commitments valida datos y retorna 201', async () => {
    vi.spyOn(PgSentinelRepository.prototype, 'saveCommitment').mockResolvedValue(undefined)
    vi.spyOn(PgSentinelRepository.prototype, 'findOrCreateCycle').mockResolvedValue(
      CommitmentCycle.create({
        commitmentId: 'new-id',
        householdId: '11111111-1111-4111-a111-111111111111',
        billingPeriod: '2026-10',
        dueDate: new Date(),
      })
    )

    const payload = {
      name: 'Internet Claro',
      dueDayOfMonth: 18,
      expectedAmount: '2150.00',
      estimatedLateFee: '350.00',
    }

    const res = await request(app)
      .post('/api/sentinel/commitments')
      .send(payload)

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(res.body.data.name).toBe('Internet Claro')
  })
})
