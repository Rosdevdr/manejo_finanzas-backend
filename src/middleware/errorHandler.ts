import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('💥 Excepción no controlada en Backend:', err)

  const statusCode = err.status || err.statusCode || 500
  const message = err.message || 'Error interno del servidor'

  return res.status(statusCode).json({
    status: 'error',
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  })
}
