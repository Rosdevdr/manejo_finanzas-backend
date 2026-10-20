import { describe, it, expect } from 'vitest'
import { Money } from '../../src/shared/domain/value-objects/money.vo.js'
import { CurrencyMismatchError, InvalidMoneyError } from '../../src/shared/domain/errors/domain.error.js'

describe('Domain Value Object: Money', () => {
  describe('Creación y Parseo Seguro', () => {
    it('debe crear Money desde centavos enteros exactos', () => {
      const money = Money.fromCents(125050, 'DOP')
      expect(money.getCents()).toBe(125050)
      expect(money.toUnits()).toBe(1250.5)
      expect(money.getCurrency()).toBe('DOP')
    })

    it('debe rechazar centavos con decimales o infinitos', () => {
      expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError)
      expect(() => Money.fromCents(Infinity)).toThrow(InvalidMoneyError)
      expect(() => Money.fromCents(NaN)).toThrow(InvalidMoneyError)
    })

    it('debe parsear strings numéricos comunes sin perder precisión', () => {
      const m1 = Money.parse('1500')
      expect(m1.getCents()).toBe(150000)

      const m2 = Money.parse('1,250.75')
      expect(m2.getCents()).toBe(125075)

      const m3 = Money.parse('0.05')
      expect(m3.getCents()).toBe(5)
    })

    it('debe resolver correctamente el bug de punto flotante de 1.005 -> 101 centavos', () => {
      // En JS puro: Math.round(1.005 * 100) = 100 (ERRÓNEO)
      // Con nuestro parseador determinista de strings:
      const money = Money.parse('1.005')
      expect(money.getCents()).toBe(101)
    })

    it('debe parsear montos negativos correctamente', () => {
      const money = Money.parse('-350.50')
      expect(money.getCents()).toBe(-35050)
      expect(money.isNegative()).toBe(true)
    })

    it('debe rechazar strings malformados o vacíos', () => {
      expect(() => Money.parse('')).toThrow(InvalidMoneyError)
      expect(() => Money.parse('abc')).toThrow(InvalidMoneyError)
      expect(() => Money.parse('12.34.56')).toThrow(InvalidMoneyError)
    })
  })

  describe('Operaciones Aritméticas Inmutables', () => {
    it('debe sumar dos montos de la misma moneda sin mutar los originales', () => {
      const a = Money.parse('100.50', 'DOP')
      const b = Money.parse('50.25', 'DOP')
      const sum = a.add(b)

      expect(sum.getCents()).toBe(15075)
      expect(sum.toUnits()).toBe(150.75)
      expect(a.getCents()).toBe(10050)
      expect(b.getCents()).toBe(5025)
    })

    it('debe restar dos montos correctamente', () => {
      const a = Money.parse('100.00', 'DOP')
      const b = Money.parse('25.50', 'DOP')
      const diff = a.subtract(b)

      expect(diff.getCents()).toBe(7450)
    })

    it('debe negar un monto', () => {
      const positive = Money.parse('200.00')
      const negated = positive.negate()

      expect(negated.getCents()).toBe(-20000)
      expect(negated.negate().getCents()).toBe(20000)
    })

    it('debe rechazar operaciones entre monedas incompatibles', () => {
      const dop = Money.parse('100.00', 'DOP')
      const usd = Money.parse('100.00', 'USD')

      expect(() => dop.add(usd)).toThrow(CurrencyMismatchError)
      expect(() => dop.subtract(usd)).toThrow(CurrencyMismatchError)
      expect(() => dop.isGreaterThan(usd)).toThrow(CurrencyMismatchError)
    })
  })

  describe('Comparaciones y Utilidades', () => {
    it('debe comparar igualdad con equals()', () => {
      const a = Money.parse('150.00', 'DOP')
      const b = Money.fromCents(15000, 'DOP')
      const c = Money.parse('150.00', 'USD')

      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })

    it('debe formatear a string legible', () => {
      const money = Money.parse('1250.50', 'DOP')
      expect(money.toFormattedString()).toBe('DOP $1,250.50')

      const neg = Money.parse('-45.00', 'USD')
      expect(neg.toFormattedString()).toBe('-USD $45.00')
    })
  })
})
