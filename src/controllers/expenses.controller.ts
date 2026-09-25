import { Request, Response } from 'express'
import { expensesService } from '../services/expenses.service.js'
import { ExpenseInput } from '../validators/schemas.js'

export async function handleListExpenses(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = req.query.period as string | undefined
  const items = await expensesService.list(userId, period)
  res.json({ status: 'success', data: items })
}

export async function handleCreateExpense(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as ExpenseInput
  const item = await expensesService.create(userId, input)
  res.status(201).json({ status: 'success', data: item })
}

export async function handleUpdateExpense(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const input = req.body as Partial<ExpenseInput>
  const item = await expensesService.update(userId, id, input)
  if (!item) {
    res.status(404).json({ status: 'fail', error: 'Gasto no encontrado' })
    return
  }
  res.json({ status: 'success', data: item })
}

export async function handleDeleteExpense(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const deleted = await expensesService.delete(userId, id)
  if (!deleted) {
    res.status(404).json({ status: 'fail', error: 'Gasto no encontrado' })
    return
  }
  res.json({ status: 'success', message: 'Gasto eliminado exitosamente' })
}
