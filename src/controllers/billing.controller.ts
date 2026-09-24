import { Request, Response, NextFunction } from 'express'
import { stripeService } from '../services/stripe.service.js'

export async function handleCreateCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await stripeService.createCheckoutSession(req.body)
    return res.status(200).json(result)
  } catch (error: any) {
    next(error)
  }
}
