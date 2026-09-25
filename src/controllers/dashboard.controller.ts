import { Request, Response } from 'express'
import { dashboardService } from '../services/dashboard.service.js'

export async function handleGetDashboardSummary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const period = (req.query.period as string) || new Date().toISOString().slice(0, 7)
  const summary = await dashboardService.getSummary(userId, period)
  res.json({ status: 'success', data: summary })
}
