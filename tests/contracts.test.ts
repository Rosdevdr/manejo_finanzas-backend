import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'

describe('QA Suite: API Contract & Schema Enforcement', () => {
  it('POST /api/stripe-checkout debe fallar si falta el userId o si no es UUID', async () => {
    const res = await request(app)
      .post('/api/stripe-checkout')
      .send({
        plan: 'pro',
        userId: 'not-a-valid-uuid',
      })

    expect(res.status).toBe(400)
    expect(res.body.status).toBe('fail')
    expect(res.body.error).toContain('validación')
  })

  it('POST /api/stripe-checkout debe fallar con plan inválido', async () => {
    const res = await request(app)
      .post('/api/stripe-checkout')
      .send({
        plan: 'enterprise_ultra',
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })

    expect(res.status).toBe(400)
    expect(res.body.status).toBe('fail')
  })

  it('POST /api/stripe-webhook debe fallar si no se envía firma', async () => {
    const res = await request(app)
      .post('/api/stripe-webhook')
      .send({ dummy: 'data' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('stripe-signature')
  })
})
