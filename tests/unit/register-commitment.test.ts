import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RegisterCommitmentUseCase } from '../../src/modules/sentinel/application/use-cases/register-commitment.use-case.js'
import type { ISentinelRepository } from '../../src/modules/sentinel/domain/ports/sentinel-repository.port.js'
import { CommitmentCycle } from '../../src/modules/sentinel/domain/entities/commitment-cycle.entity.js'

describe('RegisterCommitmentUseCase', () => {
  let mockSentinelRepo: ISentinelRepository
  let useCase: RegisterCommitmentUseCase

  beforeEach(() => {
    mockSentinelRepo = {
      saveCommitment: vi.fn().mockResolvedValue(undefined),
      findCommitmentById: vi.fn(),
      listActiveCommitments: vi.fn(),
      findCycleByCommitmentAndPeriod: vi.fn(),
      findOrCreateCycle: vi.fn().mockImplementation((commitment, period) => {
        return Promise.resolve(
          CommitmentCycle.create({
            commitmentId: commitment.getId(),
            householdId: commitment.getHouseholdId(),
            billingPeriod: period,
            dueDate: new Date(Date.UTC(2026, 9, 20)),
          })
        )
      }),
      listPendingCyclesForScan: vi.fn(),
      updateCycle: vi.fn(),
      findPendingCycleByTerms: vi.fn(),
    }

    useCase = new RegisterCommitmentUseCase(mockSentinelRepo)
  })

  it('registra un compromiso y prima el ciclo del periodo actual', async () => {
    const result = await useCase.execute({
      householdId: 'h-1',
      name: 'Luz Edesur',
      expectedAmount: '2400.00',
      currency: 'DOP',
      dueDayOfMonth: 20,
      estimatedLateFee: '500.00',
      reminderDaysBefore: [5, 2, 0],
    })

    expect(result.name).toBe('Luz Edesur')
    expect(result.dueDayOfMonth).toBe(20)
    expect(mockSentinelRepo.saveCommitment).toHaveBeenCalledTimes(1)
    expect(mockSentinelRepo.findOrCreateCycle).toHaveBeenCalledTimes(1)
  })
})
