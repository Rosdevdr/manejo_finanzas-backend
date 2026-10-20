import { describe, it, expect } from 'vitest'
import {
  RecurringCommitment,
  InvalidCommitmentError,
} from '../../src/modules/sentinel/domain/entities/recurring-commitment.entity.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'

describe('RecurringCommitment Domain Entity (Centinela Anti-Moras)', () => {
  it('crea un compromiso recurrente con valores por defecto', () => {
    const commitment = RecurringCommitment.create({
      householdId: 'h-1',
      name: 'Internet Claro Fibra',
      expectedAmount: Money.parse('2150.00', 'DOP'),
      dueDayOfMonth: 18,
      estimatedLateFee: Money.parse('350.00', 'DOP'),
    })

    expect(commitment.getName()).toBe('Internet Claro Fibra')
    expect(commitment.getDueDayOfMonth()).toBe(18)
    expect(commitment.getReminderDaysBefore()).toEqual([5, 2, 0])
    expect(commitment.getIsActive()).toBe(true)
    expect(commitment.getEstimatedLateFee().format()).toBe('DOP $350.00')
  })

  it('lanza error si el nombre está vacío o el día es inválido', () => {
    expect(() =>
      RecurringCommitment.create({
        householdId: 'h-1',
        name: '',
        dueDayOfMonth: 15,
      })
    ).toThrow(InvalidCommitmentError)

    expect(() =>
      RecurringCommitment.create({
        householdId: 'h-1',
        name: 'Gimnasio',
        dueDayOfMonth: 32,
      })
    ).toThrow(InvalidCommitmentError)
  })

  it('calcula la fecha de vencimiento ajustando meses con menos de 31 días', () => {
    const commitment = RecurringCommitment.create({
      householdId: 'h-1',
      name: 'Alquiler',
      dueDayOfMonth: 31,
    })

    // Octubre tiene 31 días
    const dueOct = commitment.calculateDueDateForPeriod(2026, 10)
    expect(dueOct.getUTCDate()).toBe(31)

    // Febrero tiene 28 días (2026 no es bisiesto)
    const dueFeb = commitment.calculateDueDateForPeriod(2026, 2)
    expect(dueFeb.getUTCDate()).toBe(28)

    // Abril tiene 30 días
    const dueApr = commitment.calculateDueDateForPeriod(2026, 4)
    expect(dueApr.getUTCDate()).toBe(30)
  })

  it('determina si corresponde alertar hoy según los días de anticipación', () => {
    const commitment = RecurringCommitment.create({
      householdId: 'h-1',
      name: 'Luz Edesur',
      dueDayOfMonth: 20,
      reminderDaysBefore: [5, 2, 0],
    })

    const dueDate = new Date(Date.UTC(2026, 9, 20)) // 20 de octubre

    // 5 días antes: 15 de octubre
    const today5 = new Date(Date.UTC(2026, 9, 15))
    expect(commitment.shouldAlertToday(today5, dueDate)).toEqual({ alert: true, daysRemaining: 5 })

    // 4 días antes: 16 de octubre (no está en la lista de recordatorios)
    const today4 = new Date(Date.UTC(2026, 9, 16))
    expect(commitment.shouldAlertToday(today4, dueDate)).toEqual({ alert: false, daysRemaining: 4 })

    // El día de vencimiento: 20 de octubre
    const today0 = new Date(Date.UTC(2026, 9, 20))
    expect(commitment.shouldAlertToday(today0, dueDate)).toEqual({ alert: true, daysRemaining: 0 })
  })
})
