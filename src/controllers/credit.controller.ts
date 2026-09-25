import { Request, Response } from 'express'
import { creditService } from '../services/credit.service.js'
import { CreditCardInput, CreditTransactionInput } from '../validators/schemas.js'

// --- Cards ---
export async function handleListCards(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const cards = await creditService.listCards(userId)
  res.json({ status: 'success', data: cards })
}

export async function handleCreateCard(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as CreditCardInput
  const card = await creditService.createCard(userId, input)
  res.status(201).json({ status: 'success', data: card })
}

export async function handleUpdateCard(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const input = req.body as Partial<CreditCardInput>
  const card = await creditService.updateCard(userId, id, input)
  if (!card) {
    res.status(404).json({ status: 'fail', error: 'Tarjeta no encontrada' })
    return
  }
  res.json({ status: 'success', data: card })
}

export async function handleDeleteCard(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const deleted = await creditService.deleteCard(userId, id)
  if (!deleted) {
    res.status(404).json({ status: 'fail', error: 'Tarjeta no encontrada' })
    return
  }
  res.json({ status: 'success', message: 'Tarjeta eliminada exitosamente' })
}

// --- Transactions ---
export async function handleListTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = req.query.period as string | undefined
  const cardId = req.query.cardId as string | undefined
  const txs = await creditService.listTransactions(userId, period, cardId)
  res.json({ status: 'success', data: txs })
}

export async function handleCreateTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as CreditTransactionInput
  const tx = await creditService.createTransaction(userId, input)
  res.status(201).json({ status: 'success', data: tx })
}

export async function handleUpdateTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const input = req.body as Partial<CreditTransactionInput>
  const tx = await creditService.updateTransaction(userId, id, input)
  if (!tx) {
    res.status(404).json({ status: 'fail', error: 'Transacción no encontrada' })
    return
  }
  res.json({ status: 'success', data: tx })
}

export async function handleDeleteTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const deleted = await creditService.deleteTransaction(userId, id)
  if (!deleted) {
    res.status(404).json({ status: 'fail', error: 'Transacción no encontrada' })
    return
  }
  res.json({ status: 'success', message: 'Transacción eliminada exitosamente' })
}

export async function handleTogglePaid(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const updated = await creditService.togglePaid(userId, id)
  if (!updated) {
    res.status(404).json({ status: 'fail', error: 'Transacción no encontrada' })
    return
  }
  res.json({ status: 'success', data: updated })
}
