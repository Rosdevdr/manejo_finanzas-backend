import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'
import { CreditCardInput, CreditTransactionInput } from '../validators/schemas.js'

export class CreditService {
  // --- Tarjetas de Crédito ---
  async listCards(userId: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('credit_cards').select('*').eq('user_id', userId).order('created_at', { ascending: true })
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return store.creditCards
  }

  async createCard(userId: string, input: CreditCardInput) {
    const id = input.id || `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const record = {
      id,
      user_id: userId,
      name: input.name,
      bank: input.bank,
      last_four_digits: input.last_four_digits,
      credit_limit: input.credit_limit,
      cutoff_day: input.cutoff_day,
      payment_due_day: input.payment_due_day,
      interest_rate: input.interest_rate,
      color: input.color,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('credit_cards').insert(record).select().single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.creditCards.push(record)
    return record
  }

  async updateCard(userId: string, id: string, input: Partial<CreditCardInput>) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('credit_cards')
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
    const index = store.creditCards.findIndex((c) => c.id === id)
    if (index !== -1) {
      store.creditCards[index] = { ...store.creditCards[index], ...input }
      return store.creditCards[index]
    }
    return null
  }

  async deleteCard(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('credit_cards').delete().eq('id', id).eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const initialLen = store.creditCards.length
    store.creditCards = store.creditCards.filter((c) => c.id !== id)
    // También borrar transacciones vinculadas
    store.creditTransactions = store.creditTransactions.filter((tx) => tx.card_id !== id)
    return store.creditCards.length < initialLen
  }

  // --- Transacciones de Tarjeta ---
  async listTransactions(userId: string, period?: string, cardId?: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      let query = supabase.from('credit_card_transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
      if (period) query = query.eq('period', period)
      if (cardId) query = query.eq('card_id', cardId)
      const { data, error } = await query
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    let list = store.creditTransactions
    if (period) list = list.filter((t) => t.period === period)
    if (cardId) list = list.filter((t) => t.card_id === cardId)
    return list
  }

  async createTransaction(userId: string, input: CreditTransactionInput) {
    const id = input.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const record = {
      id,
      user_id: userId,
      card_id: input.card_id,
      description: input.description,
      amount: input.amount,
      category: input.category,
      date: input.date,
      period: input.period,
      installments: input.installments,
      current_installment: input.current_installment,
      is_paid: input.is_paid,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('credit_card_transactions').insert(record).select().single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.creditTransactions.unshift(record)
    return record
  }

  async updateTransaction(userId: string, id: string, input: Partial<CreditTransactionInput>) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('credit_card_transactions')
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
    const index = store.creditTransactions.findIndex((t) => t.id === id)
    if (index !== -1) {
      store.creditTransactions[index] = { ...store.creditTransactions[index], ...input }
      return store.creditTransactions[index]
    }
    return null
  }

  async deleteTransaction(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('credit_card_transactions').delete().eq('id', id).eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const initialLen = store.creditTransactions.length
    store.creditTransactions = store.creditTransactions.filter((t) => t.id !== id)
    return store.creditTransactions.length < initialLen
  }

  async togglePaid(userId: string, id: string) {
    const store = inMemoryStore.getUserStore(userId)
    const current = store.creditTransactions.find((t) => t.id === id)
    const newStatus = current ? !current.is_paid : true

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data: existing } = await supabase.from('credit_card_transactions').select('is_paid').eq('id', id).eq('user_id', userId).single()
      const toggled = existing ? !existing.is_paid : newStatus
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .update({ is_paid: toggled })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
      if (!error && data) {
        return data
      }
    }

    if (current) {
      current.is_paid = newStatus
      return current
    }
    return null
  }
}

export const creditService = new CreditService()
