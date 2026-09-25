import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'
import { CashWithdrawalInput } from '../validators/schemas.js'

export class CashService {
  async list(userId: string, period?: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      let query = supabase.from('cash_withdrawals').select('*').eq('user_id', userId).order('date', { ascending: false })
      if (period) {
        query = query.eq('period', period)
      }
      const { data, error } = await query
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return period ? store.cashWithdrawals.filter((c) => c.period === period) : store.cashWithdrawals
  }

  async create(userId: string, input: CashWithdrawalInput) {
    const id = input.id || `cash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const record = {
      id,
      user_id: userId,
      amount: input.amount,
      reason: input.reason,
      note: input.note || null,
      date: input.date,
      period: input.period,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('cash_withdrawals').insert(record).select().single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.cashWithdrawals.unshift(record)
    return record
  }

  async delete(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('cash_withdrawals').delete().eq('id', id).eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const initialLen = store.cashWithdrawals.length
    store.cashWithdrawals = store.cashWithdrawals.filter((c) => c.id !== id)
    return store.cashWithdrawals.length < initialLen
  }
}

export const cashService = new CashService()
