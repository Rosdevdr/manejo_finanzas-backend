import { Request, Response } from 'express'

export function handleHealthCheck(_req: Request, res: Response) {
  const memory = process.memoryUsage()

  return res.status(200).json({
    status: 'healthy',
    service: 'aureus-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: {
      rss: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
    },
    environment: process.env.NODE_ENV || 'development',
  })
}
