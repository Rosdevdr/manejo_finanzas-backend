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

export const apiRouter = Router()

// QA Health & Diagnostics
apiRouter.get('/health', handleHealthCheck)

// AI Financial Advisor
apiRouter.post('/gemini', validateBody(geminiRequestSchema), handleGeminiGenerate)

// Billing & Subscriptions
apiRouter.post('/stripe-checkout', validateBody(stripeCheckoutSchema), handleCreateCheckout)
apiRouter.post('/stripe-webhook', handleStripeWebhook)

// Data Engineering Analytics
apiRouter.post('/analytics/calculate', validateBody(financialSummarySchema), handleCalculateMetrics)
