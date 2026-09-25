import { Request, Response } from 'express'
import { budgetsService } from '../services/budgets.service.js'
import { BudgetInput, BulkBudgetInput } from '../validators/schemas.js'

export async function handleListBudgets(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = (req.query.period as string) || new Date().toISOString().slice(0, 7)
  const items = await budgetsService.list(userId, period)
  res.json({ status: 'success', data: items })
}

export async function handleSetBudget(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as BudgetInput
  const item = await budgetsService.set(userId, input)
  res.status(200).json({ status: 'success', data: item })
}

export async function handleSetBulkBudgets(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as BulkBudgetInput
  const items = await budgetsService.setBulk(userId, input)
  res.status(200).json({ status: 'success', data: items })
}

export async function handleGetSuggestedBudgets(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = (req.query.period as string) || new Date().toISOString().slice(0, 7)
  const suggested = await budgetsService.calculateSuggested(userId, period)
  res.json({ status: 'success', data: suggested })
}
