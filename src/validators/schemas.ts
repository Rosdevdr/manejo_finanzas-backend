import { z } from 'zod'

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
