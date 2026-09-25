import { Router } from 'express'
import {
  handleListBudgets,
  handleSetBudget,
  handleSetBulkBudgets,
  handleGetSuggestedBudgets,
} from '../controllers/budgets.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { budgetSchema, bulkBudgetSchema } from '../validators/schemas.js'

export const budgetsRouter = Router()

budgetsRouter.use(requireAuth)

budgetsRouter.get('/', handleListBudgets)
budgetsRouter.get('/suggested', handleGetSuggestedBudgets)
budgetsRouter.post('/', validateBody(budgetSchema), handleSetBudget)
budgetsRouter.put('/', validateBody(budgetSchema), handleSetBudget)
budgetsRouter.post('/bulk', validateBody(bulkBudgetSchema), handleSetBulkBudgets)
