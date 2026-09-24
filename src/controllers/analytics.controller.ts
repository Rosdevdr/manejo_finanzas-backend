import { Request, Response, NextFunction } from 'express'
import { analyticsService } from '../services/analytics.service.js'

export async function handleCalculateMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const result = analyticsService.calculateSummary(req.body)
    return res.status(200).json({ status: 'success', data: result })
  } catch (error: any) {
    next(error)
  }
}
