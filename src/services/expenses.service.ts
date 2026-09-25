import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'
import { ExpenseInput } from '../validators/schemas.js'

export class ExpensesService {
  async list(userId: string, period?: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      let query = supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false })
      if (period) {
        query = query.eq('period', period)
      }
      const { data, error } = await query
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return period ? store.expenses.filter((e) => e.period === period) : store.expenses
  }

  async create(userId: string, input: ExpenseInput) {
    const id = input.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const record = {
      id,
      user_id: userId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      type: input.type,
      payment_method: input.payment_method,
      date: input.date,
      period: input.period,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('expenses').insert(record).select().single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.expenses.unshift(record)
    return record
  }

  async update(userId: string, id: string, input: Partial<ExpenseInput>) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .update(input)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const index = store.expenses.findIndex((e) => e.id === id)
    if (index !== -1) {
      store.expenses[index] = { ...store.expenses[index], ...input }
      return store.expenses[index]
    }
    return null
  }

  async delete(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const initialLen = store.expenses.length
    store.expenses = store.expenses.filter((e) => e.id !== id)
    return store.expenses.length < initialLen
  }
}

export const expensesService = new ExpensesService()
