import { describe, it, expect } from 'vitest'
import { LedgerEntry, InvalidLedgerEntryError } from '../../src/modules/ledger/domain/entities/ledger-entry.entity.js'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'

describe('Domain Entity: LedgerEntry', () => {
  const dummyHouseholdId = '11111111-1111-4111-a111-111111111111'
  const dummyUserId = '22222222-2222-4222-a222-222222222222'

  describe('Creación de Gastos (Expense) e Ingresos (Income)', () => {
    it('debe instanciar un gasto con valores por defecto y sin reversesId', () => {
      const expense = LedgerEntry.createExpense({
        householdId: dummyHouseholdId,
        userId: dummyUserId,
        amount: Money.parse('1500.00', 'DOP'),
        description: 'Supermercado semanal',
      })

      expect(expense.getId()).toBeDefined()
      expect(expense.getHouseholdId()).toBe(dummyHouseholdId)
      expect(expense.getUserId()).toBe(dummyUserId)
      expect(expense.getKind()).toBe('expense')
      expect(expense.getReversesId()).toBeNull()
      expect(expense.getAmount().getCents()).toBe(150000)
      expect(expense.getSourceLine()).toBe(1)
    })

    it('debe instanciar un ingreso con sourceLine específico', () => {
      const income = LedgerEntry.createIncome({
        householdId: dummyHouseholdId,
        userId: dummyUserId,
        sourceLine: 2,
        amount: Money.parse('50000.00', 'DOP'),
        description: 'Nómina quincenal',
      })

      expect(income.getKind()).toBe('income')
      expect(income.getSourceLine()).toBe(2)
      expect(income.getAmount().getCents()).toBe(5000000)
    })

    it('debe fallar si la descripción está vacía', () => {
      expect(() => {
        LedgerEntry.createExpense({
          householdId: dummyHouseholdId,
          userId: dummyUserId,
          amount: Money.parse('100.00'),
          description: '   ',
        })
      }).toThrow(InvalidLedgerEntryError)
    })

    it('debe fallar si el monto no es positivo', () => {
      expect(() => {
        LedgerEntry.createExpense({
          householdId: dummyHouseholdId,
          userId: dummyUserId,
          amount: Money.fromCents(0),
          description: 'Cero pesos',
        })
      }).toThrow(InvalidLedgerEntryError)

      expect(() => {
        LedgerEntry.createExpense({
          householdId: dummyHouseholdId,
          userId: dummyUserId,
          amount: Money.fromCents(-500),
          description: 'Monto negativo',
        })
      }).toThrow(InvalidLedgerEntryError)
    })
  })

  describe('Reglas de Negocio de Reversión Total', () => {
    it('debe crear una reversión 100% total que hereda household, monto y moneda del original', () => {
      const originalExpense = LedgerEntry.createExpense({
        householdId: dummyHouseholdId,
        userId: dummyUserId,
        amount: Money.parse('1200.50', 'DOP'),
        description: 'Gasolina',
      })

      const reversal = LedgerEntry.createReversal({
        originalEntry: originalExpense,
        userId: dummyUserId,
        description: 'Corrección: cobro duplicado en estación de combustible',
      })

      expect(reversal.getKind()).toBe('reversal')
      expect(reversal.getReversesId()).toBe(originalExpense.getId())
      expect(reversal.getHouseholdId()).toBe(originalExpense.getHouseholdId())
      expect(reversal.getAmount().getCents()).toBe(originalExpense.getAmount().getCents())
      expect(reversal.getAmount().getCurrency()).toBe(originalExpense.getAmount().getCurrency())
    })

    it('debe impedir estrictamente revertir una entrada que ya es una reversión', () => {
      const originalExpense = LedgerEntry.createExpense({
        householdId: dummyHouseholdId,
        userId: dummyUserId,
        amount: Money.parse('500.00'),
        description: 'Farmacia',
      })

      const firstReversal = LedgerEntry.createReversal({
        originalEntry: originalExpense,
        userId: dummyUserId,
      })

      expect(() => {
        LedgerEntry.createReversal({
          originalEntry: firstReversal,
          userId: dummyUserId,
        })
      }).toThrow(InvalidLedgerEntryError)
    })
  })

  describe('Validación de Reconstitución', () => {
    it('debe fallar si una entrada no-reversal intenta tener reversesId', () => {
      expect(() => {
        LedgerEntry.reconstitute({
          id: 'test-id',
          householdId: dummyHouseholdId,
          userId: dummyUserId,
          sourceEventId: null,
          sourceLine: 1,
          kind: 'expense',
          reversesId: 'another-entry-id', // Ilegal para expense
          amount: Money.parse('100.00'),
          description: 'Prueba',
          transactedAt: new Date(),
          createdAt: new Date(),
        })
      }).toThrow(InvalidLedgerEntryError)
    })
  })
})
