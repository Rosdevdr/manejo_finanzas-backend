import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { inMemoryStore } from '../src/services/store.js'

describe('Integration: /api/sentinel/user/commitments (Multi-User CRUD + Pay)', () => {
  const userAHeaders = {
    Authorization: 'Bearer test-token-a',
    'x-user-id': 'user-sentinel-a',
  }
  const userBHeaders = {
    Authorization: 'Bearer test-token-b',
    'x-user-id': 'user-sentinel-b',
  }

  beforeEach(() => {
    inMemoryStore.clearAll()
  })

  it('requiere autenticación (401 sin token)', async () => {
    const res = await request(app).get('/api/sentinel/user/commitments')
    expect(res.status).toBe(401)
  })

  it('ejecuta ciclo completo CRUD + Pay aislado por usuario', async () => {
    const createRes = await request(app)
      .post('/api/sentinel/user/commitments')
      .set(userAHeaders)
      .send({
        name: 'Luz Edenorte',
        contract_number: 'NIC-9910',
        category: 'electric',
        amount: 3200,
        late_fee_avoided: 350,
        due_day: 22,
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.status).toBe('success')
    const createdId = createRes.body.data.id

    // Usuario A ve el compromiso; Usuario B no ve nada
    const listA = await request(app).get('/api/sentinel/user/commitments').set(userAHeaders)
    expect(listA.status).toBe(200)
    expect(listA.body.data).toHaveLength(1)
    expect(listA.body.data[0].name).toBe('Luz Edenorte')

    const listB = await request(app).get('/api/sentinel/user/commitments').set(userBHeaders)
    expect(listB.status).toBe(200)
    expect(listB.body.data).toHaveLength(0)

    // Usuario B no puede editar ni eliminar el compromiso de A
    const forbiddenPatch = await request(app)
      .patch(`/api/sentinel/user/commitments/${createdId}`)
      .set(userBHeaders)
      .send({ amount: 9999 })
    expect(forbiddenPatch.status).toBe(404)

    // Usuario A actualiza el monto
    const patchRes = await request(app)
      .patch(`/api/sentinel/user/commitments/${createdId}`)
      .set(userAHeaders)
      .send({ amount: 3500 })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.amount).toBe(3500)

    // Usuario A marca pagado
    const payRes = await request(app)
      .post(`/api/sentinel/user/commitments/${createdId}/pay`)
      .set(userAHeaders)
      .send({ paid_period: '2026-11' })
    expect(payRes.status).toBe(200)
    expect(payRes.body.data.status).toBe('paid')
    expect(payRes.body.data.paid_period).toBe('2026-11')

    // Usuario A elimina el compromiso
    const delRes = await request(app)
      .delete(`/api/sentinel/user/commitments/${createdId}`)
      .set(userAHeaders)
    expect(delRes.status).toBe(200)

    const listAfter = await request(app).get('/api/sentinel/user/commitments').set(userAHeaders)
    expect(listAfter.body.data).toHaveLength(0)
  })
})
