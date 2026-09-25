import { z } from 'zod'

// Helpers
const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/
const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

// 1. Contrato API: Gemini AI Request
export const geminiRequestSchema = z.object({
  apiKey: z.string().min(10, 'La clave de Gemini API es requerida y debe ser válida').optional(),
  model: z.string().optional().default('gemini-flash-latest'),
  payload: z.object({
    contents: z.array(
      z.object({
        role: z.string().optional(),
        parts: z.array(
          z.object({
            text: z.string(),
          })
        ),
      })
    ),
    generationConfig: z.record(z.any()).optional(),
  }),
})

export type GeminiRequestInput = z.infer<typeof geminiRequestSchema>

// 2. Contrato API: Stripe Checkout Request
export const stripeCheckoutSchema = z.object({
  plan: z.enum(['personal', 'pro'], {
    errorMap: () => ({ message: 'El plan debe ser personal o pro' }),
  }),
  userId: z.string().uuid('El userId debe ser un UUID válido de Supabase'),
  userEmail: z.string().email('Email inválido').optional().or(z.literal('')),
})

export type StripeCheckoutInput = z.infer<typeof stripeCheckoutSchema>

// 3. Contrato API: Data Engineering Analytics Query
export const financialSummarySchema = z.object({
  incomes: z.array(
    z.object({
      id: z.string(),
      amount: z.number().positive(),
      type: z.string(),
      period: z.string(),
    })
  ),
  expenses: z.array(
    z.object({
      id: z.string(),
      amount: z.number().positive(),
      category: z.string(),
      type: z.enum(['fixed', 'variable']),
      period: z.string(),
    })
  ),
  cashWithdrawals: z.array(
    z.object({
      id: z.string(),
      amount: z.number().positive(),
      period: z.string(),
    })
  ).default([]),
  creditCards: z.array(
    z.object({
      id: z.string(),
      credit_limit: z.number().positive(),
      outstanding_balance: z.number().default(0),
    })
  ).default([]),
})

export type FinancialSummaryInput = z.infer<typeof financialSummarySchema>

// 4. Módulo: Ingresos (Incomes)
export const incomeSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  type: z.enum(['salary', 'freelance', 'investment', 'extra'], {
    errorMap: () => ({ message: 'Tipo de ingreso inválido' }),
  }),
  date: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)'),
  period: z.string().regex(periodRegex, 'Formato de período inválido (YYYY-MM)').optional(),
}).transform((data) => ({
  ...data,
  period: data.period || data.date.slice(0, 7),
}))

export type IncomeInput = z.infer<typeof incomeSchema>

// 5. Módulo: Gastos (Expenses)
export const expenseSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  category: z.enum(
    ['housing', 'food', 'transport', 'utilities', 'health', 'entertainment', 'education', 'debt', 'other'],
    { errorMap: () => ({ message: 'Categoría de gasto inválida' }) }
  ),
  type: z.enum(['fixed', 'variable'], {
    errorMap: () => ({ message: 'El tipo debe ser fijo o variable' }),
  }),
  payment_method: z.enum(['bank_transfer', 'debit_card', 'credit_card', 'cash']).optional(),
  paymentMethod: z.enum(['bank_transfer', 'debit_card', 'credit_card', 'cash']).optional(),
  date: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)'),
  period: z.string().regex(periodRegex, 'Formato de período inválido (YYYY-MM)').optional(),
}).transform((data) => ({
  ...data,
  payment_method: data.payment_method || data.paymentMethod || 'bank_transfer',
  period: data.period || data.date.slice(0, 7),
}))

export type ExpenseInput = z.infer<typeof expenseSchema>

// 6. Módulo: Retiros de Efectivo (Cash Withdrawals)
export const cashWithdrawalSchema = z.object({
  id: z.string().optional(),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  reason: z.enum(['pocket_money', 'specific_service', 'leisure_nightout', 'emergency', 'unassigned'], {
    errorMap: () => ({ message: 'Motivo de retiro inválido' }),
  }),
  note: z.string().optional().nullable(),
  date: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)'),
  period: z.string().regex(periodRegex, 'Formato de período inválido (YYYY-MM)').optional(),
}).transform((data) => ({
  ...data,
  period: data.period || data.date.slice(0, 7),
}))

export type CashWithdrawalInput = z.infer<typeof cashWithdrawalSchema>

// 7. Módulo: Tarjetas de Crédito y Transacciones
export const creditCardSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre de la tarjeta es requerido'),
  bank: z.string().min(1, 'El banco es requerido'),
  last_four_digits: z.string().regex(/^\d{4}$/, 'Los últimos 4 dígitos deben tener exactamente 4 números').optional(),
  lastFourDigits: z.string().regex(/^\d{4}$/, 'Los últimos 4 dígitos deben tener exactamente 4 números').optional(),
  credit_limit: z.number().positive('El límite de crédito debe ser mayor a 0').optional(),
  creditLimit: z.number().positive('El límite de crédito debe ser mayor a 0').optional(),
  cutoff_day: z.number().int().min(1).max(31).optional(),
  cutoffDay: z.number().int().min(1).max(31).optional(),
  payment_due_day: z.number().int().min(1).max(31).optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  interest_rate: z.number().nonnegative().optional().nullable(),
  interestRate: z.number().nonnegative().optional().nullable(),
  color: z.string().default('gold'),
}).transform((data) => ({
  id: data.id,
  name: data.name,
  bank: data.bank,
  last_four_digits: data.last_four_digits || data.lastFourDigits || '0000',
  credit_limit: data.credit_limit ?? data.creditLimit ?? 1000,
  cutoff_day: data.cutoff_day ?? data.cutoffDay ?? 15,
  payment_due_day: data.payment_due_day ?? data.paymentDueDay ?? 30,
  interest_rate: data.interest_rate ?? data.interestRate ?? null,
  color: data.color || 'gold',
}))

export type CreditCardInput = z.infer<typeof creditCardSchema>

export const creditTransactionSchema = z.object({
  id: z.string().optional(),
  card_id: z.string().optional(),
  cardId: z.string().optional(),
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  category: z.string().default('other'),
  date: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)'),
  period: z.string().regex(periodRegex, 'Formato de período inválido (YYYY-MM)').optional(),
  installments: z.number().int().min(1).default(1),
  current_installment: z.number().int().min(1).optional(),
  currentInstallment: z.number().int().min(1).optional(),
  is_paid: z.boolean().optional(),
  isPaid: z.boolean().optional(),
}).transform((data) => ({
  id: data.id,
  card_id: data.card_id || data.cardId || '',
  description: data.description,
  amount: data.amount,
  category: data.category,
  date: data.date,
  period: data.period || data.date.slice(0, 7),
  installments: data.installments || 1,
  current_installment: data.current_installment ?? data.currentInstallment ?? 1,
  is_paid: data.is_paid ?? data.isPaid ?? false,
}))

export type CreditTransactionInput = z.infer<typeof creditTransactionSchema>

// 8. Módulo: Presupuestos por Categoría (Category Budgets)
export const budgetSchema = z.object({
  id: z.string().optional(),
  period: z.string().regex(periodRegex, 'Formato de período inválido (YYYY-MM)'),
  category: z.enum(
    ['housing', 'food', 'transport', 'utilities', 'health', 'entertainment', 'education', 'debt', 'other'],
    { errorMap: () => ({ message: 'Categoría de presupuesto inválida' }) }
  ),
  limit_amount: z.number().nonnegative('El límite debe ser mayor o igual a 0').optional(),
  limitAmount: z.number().nonnegative('El límite debe ser mayor o igual a 0').optional(),
}).transform((data) => ({
  id: data.id,
  period: data.period,
  category: data.category,
  limit_amount: data.limit_amount ?? data.limitAmount ?? 0,
}))

export type BudgetInput = z.infer<typeof budgetSchema>

export const bulkBudgetSchema = z.object({
  period: z.string().regex(periodRegex, 'Formato de período inválido (YYYY-MM)'),
  budgets: z.array(
    z.object({
      category: z.enum(
        ['housing', 'food', 'transport', 'utilities', 'health', 'entertainment', 'education', 'debt', 'other']
      ),
      limit_amount: z.number().nonnegative().optional(),
      limitAmount: z.number().nonnegative().optional(),
    })
  ),
})

export type BulkBudgetInput = z.infer<typeof bulkBudgetSchema>

// 9. Módulo: Metas de Ahorro (Savings Goals)
export const savingsGoalSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre de la meta es requerido'),
  target_amount: z.number().positive('El objetivo debe ser mayor a 0').optional(),
  targetAmount: z.number().positive('El objetivo debe ser mayor a 0').optional(),
  current_amount: z.number().nonnegative().optional(),
  currentAmount: z.number().nonnegative().optional(),
  monthly_contribution: z.number().nonnegative().optional().nullable(),
  monthlyContribution: z.number().nonnegative().optional().nullable(),
  target_date: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  category: z.enum(
    ['emergency', 'vacation', 'car', 'home', 'investment', 'education', 'tech', 'other'],
    { errorMap: () => ({ message: 'Categoría de meta inválida' }) }
  ),
  color: z.string().default('#34D399'),
  is_completed: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
}).transform((data) => ({
  id: data.id,
  name: data.name,
  target_amount: data.target_amount ?? data.targetAmount ?? 1000,
  current_amount: data.current_amount ?? data.currentAmount ?? 0,
  monthly_contribution: data.monthly_contribution ?? data.monthlyContribution ?? null,
  target_date: data.target_date ?? data.targetDate ?? null,
  category: data.category,
  color: data.color || '#34D399',
  is_completed: data.is_completed ?? data.isCompleted ?? false,
}))

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>

export const depositGoalSchema = z.object({
  amount: z.number().positive('El monto a depositar debe ser mayor a 0'),
})

export type DepositGoalInput = z.infer<typeof depositGoalSchema>
