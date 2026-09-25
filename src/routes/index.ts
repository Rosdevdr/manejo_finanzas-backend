import { Router } from 'express'
import { handleHealthCheck } from '../controllers/health.controller.js'
import { handleGeminiGenerate } from '../controllers/ai.controller.js'
import { handleCreateCheckout } from '../controllers/billing.controller.js'
import { handleStripeWebhook } from '../controllers/webhook.controller.js'
import { handleCalculateMetrics } from '../controllers/analytics.controller.js'
import { validateBody } from '../middleware/validate.js'
import {
  geminiRequestSchema,
  stripeCheckoutSchema,
  financialSummarySchema,
} from '../validators/schemas.js'

import { incomesRouter } from './incomes.routes.js'
import { expensesRouter } from './expenses.routes.js'
import { cashRouter } from './cash.routes.js'
import { creditRouter } from './credit.routes.js'
import { budgetsRouter } from './budgets.routes.js'
import { goalsRouter } from './goals.routes.js'
import { dashboardRouter } from './dashboard.routes.js'

export const apiRouter = Router()

// QA Health & Diagnostics
apiRouter.get('/health', handleHealthCheck)

// AI Financial Advisor & Billing
apiRouter.post('/gemini', validateBody(geminiRequestSchema), handleGeminiGenerate)
apiRouter.post('/stripe-checkout', validateBody(stripeCheckoutSchema), handleCreateCheckout)
apiRouter.post('/stripe-webhook', handleStripeWebhook)
apiRouter.post('/analytics/calculate', validateBody(financialSummarySchema), handleCalculateMetrics)

// Thin-Client Core Financial Modules (7 Módulos)
apiRouter.use('/incomes', incomesRouter)
apiRouter.use('/expenses', expensesRouter)
apiRouter.use('/cash', cashRouter)
apiRouter.use('/credit', creditRouter)
apiRouter.use('/budgets', budgetsRouter)
apiRouter.use('/goals', goalsRouter)
apiRouter.use('/dashboard', dashboardRouter)
