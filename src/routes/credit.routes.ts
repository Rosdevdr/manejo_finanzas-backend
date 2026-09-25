import { Router } from 'express'
import {
  handleListCards,
  handleCreateCard,
  handleUpdateCard,
  handleDeleteCard,
  handleListTransactions,
  handleCreateTransaction,
  handleUpdateTransaction,
  handleDeleteTransaction,
  handleTogglePaid,
} from '../controllers/credit.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { creditCardSchema, creditTransactionSchema } from '../validators/schemas.js'

export const creditRouter = Router()

creditRouter.use(requireAuth)

// Tarjetas
creditRouter.get('/cards', handleListCards)
creditRouter.post('/cards', validateBody(creditCardSchema), handleCreateCard)
creditRouter.put('/cards/:id', handleUpdateCard)
creditRouter.delete('/cards/:id', handleDeleteCard)

// Transacciones de Tarjeta
creditRouter.get('/transactions', handleListTransactions)
creditRouter.post('/transactions', validateBody(creditTransactionSchema), handleCreateTransaction)
creditRouter.put('/transactions/:id', handleUpdateTransaction)
creditRouter.delete('/transactions/:id', handleDeleteTransaction)
creditRouter.patch('/transactions/:id/toggle-paid', handleTogglePaid)
