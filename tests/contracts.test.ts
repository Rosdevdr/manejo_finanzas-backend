import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'

describe('QA Suite: API Contract & Schema Enforcement', () => {
  it('POST /api/gemini debe fallar si el payload no tiene el formato esperado', async () => {
    const res = await request(app)
      .post('/api/gemini')
      .send({ model: 'gemini-flash-latest' })

    expect(res.status).toBe(400)
    expect(res.body.status).toBe('fail')
  })

  it('Las rutas de Stripe ya no existen (monetización retirada)', async () => {
    const checkout = await request(app).post('/api/stripe-checkout').send({})
    const webhook = await request(app).post('/api/stripe-webhook').send({})

    expect(checkout.status).toBe(404)
    expect(webhook.status).toBe(404)
  })
})
