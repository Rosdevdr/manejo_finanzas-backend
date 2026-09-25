import { Router } from 'express'
import {
  handleListIncomes,
  handleCreateIncome,
  handleUpdateIncome,
  handleDeleteIncome,
} from '../controllers/incomes.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { incomeSchema } from '../validators/schemas.js'

export const incomesRouter = Router()

incomesRouter.use(requireAuth)

incomesRouter.get('/', handleListIncomes)
incomesRouter.post('/', validateBody(incomeSchema), handleCreateIncome)
incomesRouter.put('/:id', handleUpdateIncome)
incomesRouter.delete('/:id', handleDeleteIncome)
