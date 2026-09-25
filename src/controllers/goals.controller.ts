import { Request, Response } from 'express'
import { goalsService } from '../services/goals.service.js'
import { SavingsGoalInput, DepositGoalInput } from '../validators/schemas.js'

export async function handleListGoals(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const items = await goalsService.list(userId)
  res.json({ status: 'success', data: items })
}

export async function handleCreateGoal(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as SavingsGoalInput
  const item = await goalsService.create(userId, input)
  res.status(201).json({ status: 'success', data: item })
}

export async function handleUpdateGoal(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const input = req.body as Partial<SavingsGoalInput>
  const item = await goalsService.update(userId, id, input)
  if (!item) {
    res.status(404).json({ status: 'fail', error: 'Meta de ahorro no encontrada' })
    return
  }
  res.json({ status: 'success', data: item })
}

export async function handleDeleteGoal(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const deleted = await goalsService.delete(userId, id)
  if (!deleted) {
    res.status(404).json({ status: 'fail', error: 'Meta de ahorro no encontrada' })
    return
  }
  res.json({ status: 'success', message: 'Meta de ahorro eliminada exitosamente' })
}

export async function handleDepositGoal(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const { amount } = req.body as DepositGoalInput
  const updated = await goalsService.deposit(userId, id, amount)
  if (!updated) {
    res.status(404).json({ status: 'fail', error: 'Meta de ahorro no encontrada' })
    return
  }
  res.json({ status: 'success', data: updated })
}
