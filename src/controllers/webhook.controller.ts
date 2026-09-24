import { Request, Response } from 'express'
import { stripeService } from '../services/stripe.service.js'

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature']

  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({ error: 'Falta cabecera stripe-signature' })
  }

  try {
    const rawBody = req.body as Buffer
    const event = stripeService.constructEvent(rawBody, sig)
    const result = await stripeService.handleWebhookEvent(event)
    return res.status(200).json({ received: true, ...result })
  } catch (err: any) {
    console.error('⚠️ Error procesando webhook de Stripe:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }
}
