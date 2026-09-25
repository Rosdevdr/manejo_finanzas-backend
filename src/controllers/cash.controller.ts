import { Request, Response } from 'express'
import { cashService } from '../services/cash.service.js'
import { CashWithdrawalInput } from '../validators/schemas.js'

export async function handleListCash(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = req.query.period as string | undefined
  const items = await cashService.list(userId, period)
  res.json({ status: 'success', data: items })
}

export async function handleCreateCash(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const input = req.body as CashWithdrawalInput
  const item = await cashService.create(userId, input)
  res.status(201).json({ status: 'success', data: item })
}

export async function handleDeleteCash(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const id = req.params.id
  const deleted = await cashService.delete(userId, id)
  if (!deleted) {
    res.status(404).json({ status: 'fail', error: 'Retiro no encontrado' })
    return
  }
  res.json({ status: 'success', message: 'Retiro eliminado exitosamente' })
}
