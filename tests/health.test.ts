import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'

describe('QA Suite: Health Check & System Diagnostics', () => {
  it('GET /api/health debe retornar 200 y métricas de salud del sistema', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'healthy')
    expect(res.body).toHaveProperty('service', 'aureus-backend')
    expect(res.body).toHaveProperty('version')
    expect(res.body).toHaveProperty('uptimeSeconds')
    expect(res.body.memoryUsageMb).toHaveProperty('rss')
    expect(res.body.memoryUsageMb).toHaveProperty('heapUsed')
  })

  it('GET /api/non-existent debe retornar 404', async () => {
    const res = await request(app).get('/api/ruta-desconocida')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})
