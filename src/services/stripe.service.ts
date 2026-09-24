import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { StripeCheckoutInput } from '../validators/schemas.js'

export class StripeService {
  private stripe: Stripe
  private supabaseAdmin: SupabaseClient | null = null

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_mock_dummy_key_for_dev_test', {
      apiVersion: '2025-02-24.acacia',
    })

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
      this.supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    }
  }

  private getPriceId(plan: 'personal' | 'pro'): string {
    const map = {
      personal: env.STRIPE_PRICE_PERSONAL,
      pro: env.STRIPE_PRICE_PRO,
    }
    const priceId = map[plan]
    if (!priceId) {
      throw new Error(`Price ID no configurado para el plan: ${plan}`)
    }
    return priceId
  }

  public async createCheckoutSession(input: StripeCheckoutInput): Promise<{ url: string }> {
    const priceId = this.getPriceId(input.plan)
    const appUrl = env.VITE_APP_URL || 'http://localhost:5173'

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: input.userEmail || undefined,
      client_reference_id: input.userId,
      metadata: {
        supabase_user_id: input.userId,
        plan: input.plan,
      },
      success_url: `${appUrl}/?checkout=success&plan=${input.plan}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      subscription_data: {
        metadata: {
          supabase_user_id: input.userId,
          plan: input.plan,
        },
      },
    })

    if (!session.url) {
      throw new Error('Stripe no devolvió una URL válida para checkout')
    }

    return { url: session.url }
  }

  public constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET no configurado en el servidor')
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  }

  public async handleWebhookEvent(event: Stripe.Event): Promise<{ handled: boolean; message: string }> {
    if (!this.supabaseAdmin) {
      console.warn('⚠️ Supabase Admin no inicializado. El evento no actualizará la base de datos.')
      return { handled: false, message: 'Supabase client unavailable' }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id || session.client_reference_id
        const plan = session.metadata?.plan

        if (userId && plan) {
          const subscriptionId = session.subscription as string
          const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
          const expiresAt = new Date(subscription.current_period_end * 1000).toISOString()

          await this.supabaseAdmin.from('profiles').upsert(
            {
              id: userId,
              plan,
              plan_expires_at: expiresAt,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscriptionId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )

          return { handled: true, message: `Plan '${plan}' activado para usuario ${userId}` }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string
        if (!subscriptionId) break

        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
        const userId = subscription.metadata?.supabase_user_id
        const priceId = subscription.items.data[0]?.price?.id
        const plan = priceId === env.STRIPE_PRICE_PERSONAL ? 'personal' : 'pro'
        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString()

        if (userId) {
          await this.supabaseAdmin
            .from('profiles')
            .update({
              plan,
              plan_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          return { handled: true, message: `Renovación de plan '${plan}' para usuario ${userId}` }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (userId) {
          await this.supabaseAdmin
            .from('profiles')
            .update({
              plan: 'free',
              plan_expires_at: null,
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          return { handled: true, message: `Suscripción cancelada para usuario ${userId} (revertido a free)` }
        }
        break
      }

      default:
        return { handled: true, message: `Evento ${event.type} recibido sin acción requerida` }
    }

    return { handled: false, message: 'No se procesó el evento' }
  }
}

export const stripeService = new StripeService()
