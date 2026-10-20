// ==============================================================================
// 🏛️ AUREUS · VALUE OBJECT: MONEY (INMUTABLE, CERO PUNTOS FLOTANTES)
// ==============================================================================

import { InvalidMoneyError, CurrencyMismatchError } from '../errors/domain.error.js'

export type SupportedCurrency = 'DOP' | 'USD'

export class Money {
  private readonly cents: number
  private readonly currency: SupportedCurrency

  private constructor(cents: number, currency: SupportedCurrency = 'DOP') {
    if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
      throw new InvalidMoneyError(`Los centavos deben ser un número entero finito. Recibido: ${cents}`)
    }
    this.cents = cents
    this.currency = currency
  }

  /**
   * Crea una instancia de Money a partir de un valor en centavos enteros.
   */
  public static fromCents(cents: number, currency: SupportedCurrency = 'DOP'): Money {
    return new Money(cents, currency)
  }

  public static create(cents: number | bigint, currency: SupportedCurrency = 'DOP'): Money {
    return new Money(Number(cents), currency)
  }


  /**
   * Parsea de forma determinista una cadena de texto (ej: "1200.50", "1,200", "-50.25")
   * evitando errores de redondeo de punto flotante de IEEE-754 (como Math.round(1.005 * 100) = 100).
   */
  public static parse(amountInput: string | number, currency: SupportedCurrency = 'DOP'): Money {
    if (amountInput === null || amountInput === undefined) {
      throw new InvalidMoneyError('El monto proporcionado no puede ser nulo o indefinido')
    }

    const rawStr = String(amountInput).trim().replace(/,/g, '')

    if (!rawStr || rawStr === '-' || rawStr === '+') {
      throw new InvalidMoneyError(`Formato de monto inválido: "${amountInput}"`)
    }

    const regex = /^([+-]?\d+)(\.(\d+))?$/
    const match = rawStr.match(regex)

    if (!match) {
      throw new InvalidMoneyError(`El valor "${amountInput}" no es una representación monetaria válida`)
    }

    const isNegative = match[1].startsWith('-')
    const integerPartStr = match[1].replace(/^[+-]/, '')
    const decimalPartStr = match[3] || ''

    // Tomar los primeros 2 dígitos decimales y evaluar si el 3er dígito redondea (Half-Up)
    let centsPart = 0
    if (decimalPartStr.length === 0) {
      centsPart = 0
    } else if (decimalPartStr.length === 1) {
      centsPart = parseInt(decimalPartStr, 10) * 10
    } else if (decimalPartStr.length === 2) {
      centsPart = parseInt(decimalPartStr, 10)
    } else {
      // 3 o más dígitos: redondeo bancario half-up
      const firstTwo = parseInt(decimalPartStr.slice(0, 2), 10)
      const thirdDigit = parseInt(decimalPartStr[2], 10)
      centsPart = thirdDigit >= 5 ? firstTwo + 1 : firstTwo
    }

    const intPart = parseInt(integerPartStr, 10)
    if (!Number.isSafeInteger(intPart)) {
      throw new InvalidMoneyError(`El monto "${amountInput}" excede el límite numérico seguro`)
    }

    const totalCents = intPart * 100 + centsPart
    const finalCents = isNegative ? -totalCents : totalCents

    return new Money(finalCents, currency)
  }

  public static zero(currency: SupportedCurrency = 'DOP'): Money {
    return new Money(0, currency)
  }

  public getCents(): number {
    return this.cents
  }

  public getCurrency(): SupportedCurrency {
    return this.currency
  }

  public toUnits(): number {
    return this.cents / 100
  }

  public toFormattedString(): string {
    const formattedNumber = (Math.abs(this.cents) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const prefix = this.cents < 0 ? '-' : ''
    return `${prefix}${this.currency} $${formattedNumber}`
  }

  public format(): string {
    return this.toFormattedString()
  }


  public add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.cents + other.cents, this.currency)
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.cents - other.cents, this.currency)
  }

  public negate(): Money {
    return new Money(-this.cents, this.currency)
  }

  public equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency
  }

  public isPositive(): boolean {
    return this.cents > 0
  }

  public isNegative(): boolean {
    return this.cents < 0
  }

  public isZero(): boolean {
    return this.cents === 0
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.cents > other.cents
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.cents < other.cents
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency)
    }
  }
}
