import { describe, it, expect } from 'vitest'
import {
  CommitmentCycle,
  InvalidCycleError,
} from '../../src/modules/sentinel/domain/entities/commitment-cycle.entity.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'

describe('CommitmentCycle Domain Entity (Ciclos de Pago Centinela)', () => {
  it('crea un ciclo pendiente correctamente', () => {
    const cycle = CommitmentCycle.create({
      commitmentId: 'c-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate: new Date(Date.UTC(2026, 9, 20)),
    })

    expect(cycle.getStatus()).toBe('pending')
    expect(cycle.getBillingPeriod()).toBe('2026-10')
    expect(cycle.getAlertsSentCount()).toBe(0)
    expect(cycle.getPaidEntryId()).toBeNull()
  })

  it('transiciona a estado paid con monto y entrada de ledger', () => {
    const cycle = CommitmentCycle.create({
      commitmentId: 'c-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate: new Date(Date.UTC(2026, 9, 20)),
    })

    const amount = Money.parse('2150.00', 'DOP')
    cycle.markPaid('entry-123', amount)

    expect(cycle.getStatus()).toBe('paid')
    expect(cycle.getPaidEntryId()).toBe('entry-123')
    expect(cycle.getActualAmount()?.format()).toBe('DOP $2,150.00')

    // No se puede pagar dos veces
    expect(() => cycle.markPaid('entry-456', amount)).toThrow(InvalidCycleError)
  })

  it('marca overdue si la fecha actual sobrepasa la fecha de vencimiento', () => {
    const cycle = CommitmentCycle.create({
      commitmentId: 'c-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate: new Date(Date.UTC(2026, 9, 20)),
    })

    // Antes del vencimiento
    cycle.checkOverdue(new Date(Date.UTC(2026, 9, 19)))
    expect(cycle.getStatus()).toBe('pending')

    // Pasado el vencimiento
    cycle.checkOverdue(new Date(Date.UTC(2026, 9, 21)))
    expect(cycle.getStatus()).toBe('overdue')
  })

  it('incrementa el conteo de alertas enviadas', () => {
    const cycle = CommitmentCycle.create({
      commitmentId: 'c-1',
      householdId: 'h-1',
      billingPeriod: '2026-10',
      dueDate: new Date(Date.UTC(2026, 9, 20)),
    })

    expect(cycle.getAlertsSentCount()).toBe(0)
    cycle.recordAlertSent(new Date())
    expect(cycle.getAlertsSentCount()).toBe(1)
  })
})
