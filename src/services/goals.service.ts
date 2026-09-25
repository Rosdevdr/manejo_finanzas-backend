import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'
import { SavingsGoalInput } from '../validators/schemas.js'

export class GoalsService {
  async list(userId: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return store.savingsGoals
  }

  async create(userId: string, input: SavingsGoalInput) {
    const id = input.id || `goal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const isCompleted = input.current_amount >= input.target_amount
    const record = {
      id,
      user_id: userId,
      name: input.name,
      target_amount: input.target_amount,
      current_amount: input.current_amount,
      monthly_contribution: input.monthly_contribution,
      target_date: input.target_date,
      category: input.category,
      color: input.color,
      is_completed: isCompleted,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('savings_goals').insert(record).select().single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    store.savingsGoals.push(record)
    return record
  }

  async update(userId: string, id: string, input: Partial<SavingsGoalInput>) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data: current } = await supabase.from('savings_goals').select('*').eq('id', id).eq('user_id', userId).single()
      if (current) {
        const targetAmount = input.target_amount ?? current.target_amount
        const currentAmount = input.current_amount ?? current.current_amount
        const isCompleted = currentAmount >= targetAmount
        const patch = { ...input, is_completed: isCompleted }

        const { data, error } = await supabase
          .from('savings_goals')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single()
        if (!error && data) {
          return data
        }
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const index = store.savingsGoals.findIndex((g) => g.id === id)
    if (index !== -1) {
      const current = store.savingsGoals[index]
      const targetAmount = input.target_amount ?? current.target_amount
      const currentAmount = input.current_amount ?? current.current_amount
      const isCompleted = currentAmount >= targetAmount
      store.savingsGoals[index] = {
        ...current,
        ...input,
        is_completed: isCompleted,
      }
      return store.savingsGoals[index]
    }
    return null
  }

  async delete(userId: string, id: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id).eq('user_id', userId)
      if (!error) {
        return true
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const initialLen = store.savingsGoals.length
    store.savingsGoals = store.savingsGoals.filter((g) => g.id !== id)
    return store.savingsGoals.length < initialLen
  }

  async deposit(userId: string, id: string, amount: number) {
    const store = inMemoryStore.getUserStore(userId)
    const goal = store.savingsGoals.find((g) => g.id === id)

    let currentAmount = 0
    let targetAmount = 1000

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data: dbGoal } = await supabase.from('savings_goals').select('*').eq('id', id).eq('user_id', userId).single()
      if (dbGoal) {
        currentAmount = Number(dbGoal.current_amount || 0) + amount
        targetAmount = Number(dbGoal.target_amount)
        const isCompleted = currentAmount >= targetAmount
        const { data, error } = await supabase
          .from('savings_goals')
          .update({ current_amount: currentAmount, is_completed: isCompleted })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single()
        if (!error && data) {
          return data
        }
      }
    }

    if (goal) {
      goal.current_amount = Number((goal.current_amount + amount).toFixed(2))
      goal.is_completed = goal.current_amount >= goal.target_amount
      return goal
    }
    return null
  }
}

export const goalsService = new GoalsService()
