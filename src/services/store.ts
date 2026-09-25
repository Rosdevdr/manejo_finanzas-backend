/**
 * Almacenamiento en memoria para desarrollo local sin conexión y QA/Testing automatizado.
 * Si Supabase no está configurado o falla la red, el backend continúa respondiendo
 * con total fidelidad y aislamiento por userId.
 */

export interface InMemoryStoreData {
  incomes: any[]
  expenses: any[]
  cashWithdrawals: any[]
  creditCards: any[]
  creditTransactions: any[]
  categoryBudgets: any[]
  savingsGoals: any[]
}

class InMemoryStore {
  private userStores = new Map<string, InMemoryStoreData>()

  public getUserStore(userId: string): InMemoryStoreData {
    if (!this.userStores.has(userId)) {
      this.userStores.set(userId, {
        incomes: [],
        expenses: [],
        cashWithdrawals: [],
        creditCards: [],
        creditTransactions: [],
        categoryBudgets: [],
        savingsGoals: [],
      })
    }
    return this.userStores.get(userId)!
  }

  public clearUser(userId: string) {
    this.userStores.delete(userId)
  }

  public clearAll() {
    this.userStores.clear()
  }
}

export const inMemoryStore = new InMemoryStore()
