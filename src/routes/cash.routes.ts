import { Router } from 'express'
import {
  handleListCash,
  handleCreateCash,
  handleDeleteCash,
} from '../controllers/cash.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { cashWithdrawalSchema } from '../validators/schemas.js'

export const cashRouter = Router()

cashRouter.use(requireAuth)

cashRouter.get('/', handleListCash)
cashRouter.post('/', validateBody(cashWithdrawalSchema), handleCreateCash)
cashRouter.delete('/:id', handleDeleteCash)
