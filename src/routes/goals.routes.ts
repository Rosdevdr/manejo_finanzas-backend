import { Router } from 'express'
import {
  handleListGoals,
  handleCreateGoal,
  handleUpdateGoal,
  handleDeleteGoal,
  handleDepositGoal,
} from '../controllers/goals.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { savingsGoalSchema, depositGoalSchema } from '../validators/schemas.js'

export const goalsRouter = Router()

goalsRouter.use(requireAuth)

goalsRouter.get('/', handleListGoals)
goalsRouter.post('/', validateBody(savingsGoalSchema), handleCreateGoal)
goalsRouter.put('/:id', handleUpdateGoal)
goalsRouter.delete('/:id', handleDeleteGoal)
goalsRouter.post('/:id/deposit', validateBody(depositGoalSchema), handleDepositGoal)
