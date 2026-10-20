import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MatchPaymentToCommitmentUseCase } from '../../src/modules/sentinel/application/use-cases/match-payment-to-commitment.use-case.js'
import { RecurringCommitment } from '../../src/modules/sentinel/domain/entities/recurring-commitment.entity.js'
import { CommitmentCycle } from '../../src/modules/sentinel/domain/entities/commitment-cycle.entity.js'
import type { ISentinelRepository } from '../../src/modules/sentinel/domain/ports/sentinel-repository.port.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'

describe('MatchPaymentToCommitmentUseCase (Conciliación Automática Centinela)', () => {
  let mockSentinelRepo: ISentinelRepository
  let useCase: MatchPaymentToCommitmentUseCase

  beforeEach(() => {
    mockSentinelRepo = {
      saveCommitment: vi.fn(),
      findCommitmentById: vi.fn(),
      listActiveCommitments: vi.fn(),
      findCycleByCommitmentAndPeriod: vi.fn(),
      findOrCreateCycle: vi.fn(),
      listPendingCyclesForScan: vi.fn(),
      updateCycle: vi.fn().mockResolvedValue(undefined),
      findPendingCycleByTerms: vi.fn(),
    }

    useCase = new MatchPaymentToCommitmentUseCase(mockSentinelRepo)
  })

  it('concilia pago cuando la descripción del gasto coincide con el compromiso', async () => {
    const commitment = RecurringCommitment.create({
      id: 'comm-edesur',
      householdId: 'h-1',
      name: 'Luz Edesur',
      dueDayOfMonth: 22,
      estimatedLateFee: Money.parse('600.00', 'DOP'),
    })

    const cycle = CommitmentCycle.create({
      id: 'cycle-edesur',
      commitmentId: 'comm-edesur',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate: new Date(Date.UTC(2026, 9, 22)),
    })

    vi.mocked(mockSentinelRepo.findPendingCycleByTerms).mockResolvedValue({
      commitment,
      cycle,
    })

    const result = await useCase.execute({
      householdId: 'h-1',
      ledgerEntryId: 'ledger-entry-uuid-777',
      description: 'Pago de factura luz edesur',
      amount: Money.parse('2350.00', 'DOP'),
      transactedAt: new Date(Date.UTC(2026, 9, 20)),
    })

    expect(result.matched).toBe(true)
    expect(result.commitmentName).toBe('Luz Edesur')
    expect(result.savedLateFeeFormatted).toBe('DOP $600.00')

    // Verificamos que el ciclo se actualizó a pagado
    expect(cycle.getStatus()).toBe('paid')
    expect(cycle.getPaidEntryId()).toBe('ledger-entry-uuid-777')
    expect(cycle.getActualAmount()?.format()).toBe('DOP $2,350.00')
    expect(mockSentinelRepo.updateCycle).toHaveBeenCalledWith(cycle)
  })

  it('no concilia si no se encuentra ningún ciclo pendiente que coincida', async () => {
    vi.mocked(mockSentinelRepo.findPendingCycleByTerms).mockResolvedValue(null)

    const result = await useCase.execute({
      householdId: 'h-1',
      ledgerEntryId: 'ledger-entry-uuid-888',
      description: 'Cena en restaurante',
      amount: Money.parse('1500.00', 'DOP'),
    })

    expect(result.matched).toBe(false)
    expect(mockSentinelRepo.updateCycle).not.toHaveBeenCalled()
  })
})
