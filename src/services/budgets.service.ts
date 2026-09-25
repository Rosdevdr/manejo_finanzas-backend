import { getSupabaseAdmin } from '../config/supabase.js'
import { inMemoryStore } from './store.js'
import { BudgetInput, BulkBudgetInput } from '../validators/schemas.js'
import { incomesService } from './incomes.service.js'

export class BudgetsService {
  async list(userId: string, period: string) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('period', period)
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    return store.categoryBudgets.filter((b) => b.period === period)
  }

  async set(userId: string, input: BudgetInput) {
    const id = input.id || `bud-${userId}-${input.period}-${input.category}`
    const record = {
      id,
      user_id: userId,
      period: input.period,
      category: input.category,
      limit_amount: input.limit_amount,
      created_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase
        .from('category_budgets')
        .upsert(record, { onConflict: 'user_id,period,category' })
        .select()
        .single()
      if (!error && data) {
        return data
      }
    }

    const store = inMemoryStore.getUserStore(userId)
    const existingIndex = store.categoryBudgets.findIndex(
      (b) => b.period === input.period && b.category === input.category
    )
    if (existingIndex !== -1) {
      store.categoryBudgets[existingIndex] = record
    } else {
      store.categoryBudgets.push(record)
    }
    return record
  }

  async setBulk(userId: string, input: BulkBudgetInput) {
    const results = []
    for (const b of input.budgets) {
      const saved = await this.set(userId, {
        id: undefined,
        period: input.period,
        category: b.category,
        limit_amount: b.limit_amount ?? b.limitAmount ?? 0,
      })
      results.push(saved)
    }
    return results
  }

  /**
   * Cálculo inteligente de límites sugeridos por regla financiera 50/30/20.
   */
  async calculateSuggested(userId: string, period: string) {
    const incomes = await incomesService.list(userId, period)
    const totalIncome = incomes.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)

    const needsPool = totalIncome * 0.50
    const wantsPool = totalIncome * 0.30
    const savingsPool = totalIncome * 0.20

    return {
      period,
      totalIncome: Number(totalIncome.toFixed(2)),
      pools: {
        needs: Number(needsPool.toFixed(2)),
        wants: Number(wantsPool.toFixed(2)),
        savings: Number(savingsPool.toFixed(2)),
      },
      suggestedCategories: [
        { category: 'housing', limitAmount: Number((needsPool * 0.40).toFixed(2)) },
        { category: 'food', limitAmount: Number((needsPool * 0.25).toFixed(2)) },
        { category: 'transport', limitAmount: Number((needsPool * 0.15).toFixed(2)) },
        { category: 'utilities', limitAmount: Number((needsPool * 0.10).toFixed(2)) },
        { category: 'health', limitAmount: Number((needsPool * 0.10).toFixed(2)) },
        { category: 'entertainment', limitAmount: Number((wantsPool * 0.50).toFixed(2)) },
        { category: 'other', limitAmount: Number((wantsPool * 0.50).toFixed(2)) },
      ],
    }
  }
}

export const budgetsService = new BudgetsService()
