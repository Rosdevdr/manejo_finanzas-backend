import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'
import { IncomeInput } from '../validators/schemas.js'

export class IncomesService {
  async list(userId: string, period?: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      let query = supabase.from('incomes').select('*').eq('user_id', userId).order('date', { ascending: false })
      if (period) {
        query = query.eq('period', period)
      }
      const { data, error } = await query
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return period ? store.incomes.filter((i) => i.period === period) : store.incomes
  }

  async create(userId: string, input: IncomeInput) {
    const id = input.id || `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const record = {
      id,
      user_id: userId,
      description: input.description,
      amount: input.amount,
      type: input.type,
      date: input.date,
      period: input.period,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('incomes').insert(record).select().single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.incomes.unshift(record)
    return record
  }

  async update(userId: string, id: string, input: Partial<IncomeInput>) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('incomes')
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
    const index = store.incomes.findIndex((i) => i.id === id)
    if (index !== -1) {
      store.incomes[index] = { ...store.incomes[index], ...input }
      return store.incomes[index]
    }
    return null
  }

  async delete(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('incomes').delete().eq('id', id).eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const initialLen = store.incomes.length
    store.incomes = store.incomes.filter((i) => i.id !== id)
    return store.incomes.length < initialLen
  }
}

export const incomesService = new IncomesService()
