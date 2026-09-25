import { Router } from 'express'
import {
  handleListExpenses,
  handleCreateExpense,
  handleUpdateExpense,
  handleDeleteExpense,
} from '../controllers/expenses.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { expenseSchema } from '../validators/schemas.js'

export const expensesRouter = Router()

expensesRouter.use(requireAuth)

expensesRouter.get('/', handleListExpenses)
expensesRouter.post('/', validateBody(expenseSchema), handleCreateExpense)
expensesRouter.put('/:id', handleUpdateExpense)
expensesRouter.delete('/:id', handleDeleteExpense)
