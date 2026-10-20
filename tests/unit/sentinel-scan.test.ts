import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SentinelScanUseCase } from '../../src/modules/sentinel/application/use-cases/sentinel-scan.use-case.js'
import { RecurringCommitment } from '../../src/modules/sentinel/domain/entities/recurring-commitment.entity.js'
import { CommitmentCycle } from '../../src/modules/sentinel/domain/entities/commitment-cycle.entity.js'
import type { ISentinelRepository } from '../../src/modules/sentinel/domain/ports/sentinel-repository.port.js'
import type { IIdentityRepository } from '../../src/modules/messaging/domain/ports/identity-repository.port.js'
import type { IOutboxRepository } from '../../src/modules/messaging/domain/ports/outbox-repository.port.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'
import type { OutboxMessage } from '../../src/modules/messaging/domain/entities/outbox-message.entity.js'

describe('SentinelScanUseCase (Escaneo Centinela Anti-Moras)', () => {
  let mockSentinelRepo: ISentinelRepository
  let mockIdentityRepo: IIdentityRepository
  let mockOutboxRepo: IOutboxRepository
  let scanUseCase: SentinelScanUseCase

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

    mockIdentityRepo = {
      findUserByChannel: vi.fn(),
      findOrCreateUserForChannel: vi.fn(),
      findPrimaryChannelForHousehold: vi.fn().mockResolvedValue({
        provider: 'telegram',
        recipientId: 'tg-chat-12345',
      }),
    }

    mockOutboxRepo = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      claimPendingBatch: vi.fn(),
      update: vi.fn(),
      findById: vi.fn(),
    }

    scanUseCase = new SentinelScanUseCase(mockSentinelRepo, mockIdentityRepo, mockOutboxRepo)
  })

  it('detecta compromiso que vence en 2 días y encola alerta en Outbox con estimación de mora', async () => {
    const today = new Date(Date.UTC(2026, 9, 18)) // 18 de octubre
    const dueDate = new Date(Date.UTC(2026, 9, 20)) // Vence en 2 días

    const commitment = RecurringCommitment.create({
      id: 'comm-1',
      householdId: 'h-1',
      name: 'Internet Claro',
      expectedAmount: Money.parse('2150.00', 'DOP'),
      dueDayOfMonth: 20,
      reminderDaysBefore: [5, 2, 0],
      estimatedLateFee: Money.parse('350.00', 'DOP'),
    })

    const cycle = CommitmentCycle.create({
      id: 'cycle-1',
      commitmentId: 'comm-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate,
    })

    vi.mocked(mockSentinelRepo.listPendingCyclesForScan).mockResolvedValue([
      { commitment, cycle },
    ])

    const result = await scanUseCase.execute({ asOfDate: today })

    expect(result.scannedCount).toBe(1)
    expect(result.alertsGeneratedCount).toBe(1)

    // Verificamos que se encoló el mensaje en Outbox
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1)
    const enqueuedMsg = vi.mocked(mockOutboxRepo.enqueue).mock.calls[0][0] as OutboxMessage
    expect(enqueuedMsg.getProvider()).toBe('telegram')
    expect(enqueuedMsg.getRecipientId()).toBe('tg-chat-12345')
    const payload = enqueuedMsg.getPayload()
    expect(payload.text).toContain('Internet Claro')
    expect(payload.text).toContain('vence en <b>2 días</b>')
    expect(payload.text).toContain('DOP $350.00')

    // Verificamos que el ciclo registró la alerta y se guardó
    expect(cycle.getAlertsSentCount()).toBe(1)
    expect(mockSentinelRepo.updateCycle).toHaveBeenCalledWith(cycle)
  })

  it('no envía alerta duplicada el mismo día calendario (idempotencia diaria)', async () => {
    const today = new Date(Date.UTC(2026, 9, 18, 14, 0, 0)) // 18 de octubre 2:00 PM
    const dueDate = new Date(Date.UTC(2026, 9, 20))

    const commitment = RecurringCommitment.create({
      id: 'comm-1',
      householdId: 'h-1',
      name: 'Luz Edesur',
      dueDayOfMonth: 20,
      reminderDaysBefore: [2],
    })

    const cycle = CommitmentCycle.create({
      id: 'cycle-1',
      commitmentId: 'comm-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate,
    })

    // Ya fue alertado hoy a las 8:00 AM
    cycle.recordAlertSent(new Date(Date.UTC(2026, 9, 18, 8, 0, 0)))

    vi.mocked(mockSentinelRepo.listPendingCyclesForScan).mockResolvedValue([
      { commitment, cycle },
    ])

    const result = await scanUseCase.execute({ asOfDate: today })

    expect(result.alertsGeneratedCount).toBe(0)
    expect(mockOutboxRepo.enqueue).not.toHaveBeenCalled()
  })
})
