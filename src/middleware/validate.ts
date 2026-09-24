import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'fail',
          error: 'Error de validación de contrato API',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      return res.status(400).json({ status: 'fail', error: 'Payload inválido' })
    }
  }
}
