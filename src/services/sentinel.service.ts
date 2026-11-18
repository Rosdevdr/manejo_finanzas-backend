import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'

export interface SentinelCommitmentInput {
  id?: string
  name: string
  contract_number?: string
  category?: 'electric' | 'telecom' | 'card' | 'education' | 'water' | 'other'
  amount: number
  late_fee_avoided?: number
  due_day: number
  due_date_str?: string
  status?: 'pending' | 'paid' | 'urgent'
  paid_period?: string | null
}

export class SentinelService {
  async list(userId: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('sentinel_commitments')
        .select('*')
        .eq('user_id', userId)
        .order('due_day', { ascending: true })
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return [...store.sentinelCommitments].sort((a, b) => Number(a.due_day) - Number(b.due_day))
  }

  async create(userId: string, input: SentinelCommitmentInput) {
    const id = input.id || `sent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()
    const record = {
      id,
      user_id: userId,
      name: input.name.trim().slice(0, 60),
      contract_number: (input.contract_number || 'Servicio Recurrente').trim().slice(0, 50),
      category: input.category || 'other',
      amount: Number(input.amount),
      late_fee_avoided: Number(input.late_fee_avoided ?? 0),
      due_day: Number(input.due_day),
      due_date_str: input.due_date_str || `${String(input.due_day).padStart(2, '0')} del mes`,
      status: input.status || 'pending',
      paid_period: input.paid_period ?? null,
      created_at: now,
      updated_at: now,
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('sentinel_commitments')
        .insert(record)
        .select()
        .single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.sentinelCommitments.unshift(record)
    return record
  }

  async update(userId: string, id: string, input: Partial<SentinelCommitmentInput>) {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (input.name !== undefined) updates.name = input.name.trim().slice(0, 60)
    if (input.contract_number !== undefined) {
      updates.contract_number = input.contract_number.trim().slice(0, 50)
    }
    if (input.category !== undefined) updates.category = input.category
    if (input.amount !== undefined) updates.amount = Number(input.amount)
    if (input.late_fee_avoided !== undefined) {
      updates.late_fee_avoided = Number(input.late_fee_avoided)
    }
    if (input.due_day !== undefined) updates.due_day = Number(input.due_day)
    if (input.due_date_str !== undefined) updates.due_date_str = input.due_date_str
    if (input.status !== undefined) updates.status = input.status
    if (input.paid_period !== undefined) updates.paid_period = input.paid_period

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('sentinel_commitments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const idx = store.sentinelCommitments.findIndex(c => c.id === id)
    if (idx !== -1) {
      store.sentinelCommitments[idx] = { ...store.sentinelCommitments[idx], ...updates }
      return store.sentinelCommitments[idx]
    }
    return null
  }

  async markPaid(userId: string, id: string, paidPeriod?: string) {
    const period = paidPeriod || new Date().toISOString().slice(0, 7)
    return this.update(userId, id, {
      status: 'paid',
      paid_period: period,
    })
  }

  async remove(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase
        .from('sentinel_commitments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const before = store.sentinelCommitments.length
    store.sentinelCommitments = store.sentinelCommitments.filter(c => c.id !== id)
    return store.sentinelCommitments.length < before
  }
}

export const sentinelService = new SentinelService()
