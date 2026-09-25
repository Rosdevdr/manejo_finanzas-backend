import { Request, Response } from 'express'
import { incomesService } from '../services/incomes.service.js'
import { IncomeInput } from '../validators/schemas.js'

export async function handleListIncomes(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = req.query.period as string | undefined
  const items = await incomesService.list(userId, period)
  res.json({ status: 'success', data: items })
}

export async function handleCreateIncome(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as IncomeInput
  const item = await incomesService.create(userId, input)
  res.status(201).json({ status: 'success', data: item })
}

export async function handleUpdateIncome(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const input = req.body as Partial<IncomeInput>
  const item = await incomesService.update(userId, id, input)
  if (!item) {
    res.status(404).json({ status: 'fail', error: 'Ingreso no encontrado' })
    return
  }
  res.json({ status: 'success', data: item })
}

export async function handleDeleteIncome(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const deleted = await incomesService.delete(userId, id)
  if (!deleted) {
    res.status(404).json({ status: 'fail', error: 'Ingreso no encontrado' })
    return
  }
  res.json({ status: 'success', message: 'Ingreso eliminado exitosamente' })
}
