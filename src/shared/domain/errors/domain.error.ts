// ==============================================================================
// 🏛️ AUREUS · SHARED DOMAIN ERRORS
// ==============================================================================

export abstract class DomainError extends Error {
  public readonly isDomainError = true

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InvalidMoneyError extends DomainError {
  constructor(message: string) {
    super(`[Money] ${message}`)
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(c1: string, c2: string) {
    super(`[Money] No es posible operar entre monedas distintas: ${c1} y ${c2}`)
  }
}
