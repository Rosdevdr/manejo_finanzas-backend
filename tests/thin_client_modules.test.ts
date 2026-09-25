import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { inMemoryStore } from '../src/services/store.js'

describe('Thin-Client Core Modules & Dashboard API Suite', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001'
  const authHeaders = {
    'Authorization': 'Bearer test-token-valid',
    'x-user-id': testUserId,
  }

  beforeEach(() => {
    inMemoryStore.clearUser(testUserId)
  })

  // --- Auth Enforcement ---
  describe('Autenticación y Seguridad', () => {
    it('debe rechazar peticiones sin token con 401', async () => {
      const res = await request(app).get('/api/incomes')
      expect(res.status).toBe(401)
      expect(res.body.error).toContain('Token')
    })
  })

  // --- 1. Incomes ---
  describe('Módulo: Incomes (/api/incomes)', () => {
    it('debe crear, listar, actualizar y eliminar ingresos', async () => {
      // Create
      const createRes = await request(app)
        .post('/api/incomes')
        .set(authHeaders)
        .send({
          description: 'Sueldo Senior Engineer',
          amount: 95000,
          type: 'salary',
          date: '2026-09-01',
          period: '2026-09',
        })
      expect(createRes.status).toBe(201)
      expect(createRes.body.status).toBe('success')
      const createdId = createRes.body.data.id

      // List
      const listRes = await request(app)
        .get('/api/incomes?period=2026-09')
        .set(authHeaders)
      expect(listRes.status).toBe(200)
      expect(listRes.body.data.length).toBe(1)
      expect(listRes.body.data[0].amount).toBe(95000)

      // Update
      const updateRes = await request(app)
        .put(`/api/incomes/${createdId}`)
        .set(authHeaders)
        .send({ amount: 98000 })
      expect(updateRes.status).toBe(200)
      expect(updateRes.body.data.amount).toBe(98000)

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/incomes/${createdId}`)
        .set(authHeaders)
      expect(deleteRes.status).toBe(200)

      // List again
      const emptyRes = await request(app)
        .get('/api/incomes')
        .set(authHeaders)
      expect(emptyRes.body.data.length).toBe(0)
    })
  })

  // --- 2. Expenses ---
  describe('Módulo: Expenses (/api/expenses)', () => {
    it('debe crear, listar y eliminar gastos', async () => {
      const createRes = await request(app)
        .post('/api/expenses')
        .set(authHeaders)
        .send({
          description: 'Supermercado Mensual',
          amount: 12000,
          category: 'food',
          type: 'variable',
          payment_method: 'debit_card',
          date: '2026-09-05',
          period: '2026-09',
        })
      expect(createRes.status).toBe(201)
      const expenseId = createRes.body.data.id

      const listRes = await request(app)
        .get('/api/expenses?period=2026-09')
        .set(authHeaders)
      expect(listRes.status).toBe(200)
      expect(listRes.body.data.length).toBe(1)

      const deleteRes = await request(app)
        .delete(`/api/expenses/${expenseId}`)
        .set(authHeaders)
      expect(deleteRes.status).toBe(200)
    })
  })

  // --- 3. Cash Withdrawals ---
  describe('Módulo: Cash (/api/cash)', () => {
    it('debe registrar y listar retiros en efectivo', async () => {
      const createRes = await request(app)
        .post('/api/cash')
        .set(authHeaders)
        .send({
          amount: 3000,
          reason: 'pocket_money',
          note: 'Efectivo para la semana',
          date: '2026-09-02',
          period: '2026-09',
        })
      expect(createRes.status).toBe(201)

      const listRes = await request(app)
        .get('/api/cash?period=2026-09')
        .set(authHeaders)
      expect(listRes.status).toBe(200)
      expect(listRes.body.data[0].amount).toBe(3000)
    })
  })

  // --- 4. Credit Cards & Transactions ---
  describe('Módulo: Credit (/api/credit)', () => {
    it('debe gestionar tarjetas y transacciones de crédito', async () => {
      // Card
      const cardRes = await request(app)
        .post('/api/credit/cards')
        .set(authHeaders)
        .send({
          name: 'Visa Signature',
          bank: 'Banco BHD',
          lastFourDigits: '8811',
          creditLimit: 150000,
          cutoffDay: 15,
          paymentDueDay: 5,
        })
      expect(cardRes.status).toBe(201)
      const cardId = cardRes.body.data.id

      // Transaction
      const txRes = await request(app)
        .post('/api/credit/transactions')
        .set(authHeaders)
        .send({
          cardId,
          description: 'Cena Restaurante',
          amount: 4500,
          category: 'food',
          date: '2026-09-08',
          period: '2026-09',
        })
      expect(txRes.status).toBe(201)
      const txId = txRes.body.data.id

      // Toggle Paid
      const toggleRes = await request(app)
        .patch(`/api/credit/transactions/${txId}/toggle-paid`)
        .set(authHeaders)
      expect(toggleRes.status).toBe(200)
      expect(toggleRes.body.data.is_paid).toBe(true)
    })
  })

  // --- 5. Budgets ---
  describe('Módulo: Budgets (/api/budgets)', () => {
    it('debe gestionar presupuestos por categoría y límites sugeridos 50/30/20', async () => {
      // Primero crear un ingreso para poder sugerir
      await request(app)
        .post('/api/incomes')
        .set(authHeaders)
        .send({
          description: 'Sueldo Base',
          amount: 100000,
          type: 'salary',
          date: '2026-09-01',
          period: '2026-09',
        })

      // Sugeridos 50/30/20
      const suggestedRes = await request(app)
        .get('/api/budgets/suggested?period=2026-09')
        .set(authHeaders)
      expect(suggestedRes.status).toBe(200)
      expect(suggestedRes.body.data.pools.needs).toBe(50000)
      expect(suggestedRes.body.data.pools.wants).toBe(30000)
      expect(suggestedRes.body.data.pools.savings).toBe(20000)

      // Guardar presupuesto
      const setRes = await request(app)
        .post('/api/budgets')
        .set(authHeaders)
        .send({
          period: '2026-09',
          category: 'food',
          limitAmount: 15000,
        })
      expect(setRes.status).toBe(200)
      expect(setRes.body.data.limit_amount).toBe(15000)
    })
  })

  // --- 6. Goals ---
  describe('Módulo: Goals (/api/goals)', () => {
    it('debe crear metas de ahorro y registrar depósitos acumulativos', async () => {
      const goalRes = await request(app)
        .post('/api/goals')
        .set(authHeaders)
        .send({
          name: 'Fondo de Emergencia',
          targetAmount: 50000,
          currentAmount: 10000,
          category: 'emergency',
        })
      expect(goalRes.status).toBe(201)
      const goalId = goalRes.body.data.id

      // Depósito
      const depRes = await request(app)
        .post(`/api/goals/${goalId}/deposit`)
        .set(authHeaders)
        .send({ amount: 5000 })
      expect(depRes.status).toBe(200)
      expect(depRes.body.data.current_amount).toBe(15000)
      expect(depRes.body.data.is_completed).toBe(false)
    })
  })

  // --- 7. Dashboard Summary Engine ---
  describe('Módulo: Dashboard (/api/dashboard/summary)', () => {
    it('debe calcular con precisión matemática balance, arrastre, liquidez y score de salud', async () => {
      // 1. Ingreso mes anterior (Agosto) para probar Arrastre (carry-over)
      await request(app).post('/api/incomes').set(authHeaders).send({
        description: 'Sueldo Agosto',
        amount: 80000,
        type: 'salary',
        date: '2026-08-01',
        period: '2026-08',
      })

      // Gasto mes anterior (Agosto)
      await request(app).post('/api/expenses').set(authHeaders).send({
        description: 'Alquiler Agosto',
        amount: 30000,
        category: 'housing',
        type: 'fixed',
        date: '2026-08-05',
        period: '2026-08',
      })
      // Arrastre esperado de Agosto: 80000 - 30000 = 50000

      // 2. Movimientos Septiembre (Mes actual)
      await request(app).post('/api/incomes').set(authHeaders).send({
        description: 'Sueldo Septiembre',
        amount: 100000,
        type: 'salary',
        date: '2026-09-01',
        period: '2026-09',
      })

      await request(app).post('/api/expenses').set(authHeaders).send({
        description: 'Supermercado Septiembre',
        amount: 20000,
        category: 'food',
        type: 'variable',
        date: '2026-09-03',
        period: '2026-09',
      })

      await request(app).post('/api/cash').set(authHeaders).send({
        amount: 5000,
        reason: 'pocket_money',
        date: '2026-09-04',
        period: '2026-09',
      })

      // Tarjeta de crédito con deuda pendiente
      const cardRes = await request(app).post('/api/credit/cards').set(authHeaders).send({
        name: 'Mastercard Gold',
        bank: 'Popular',
        creditLimit: 50000,
      })
      await request(app).post('/api/credit/transactions').set(authHeaders).send({
        cardId: cardRes.body.data.id,
        description: 'Combustible',
        amount: 3000,
        date: '2026-09-06',
        period: '2026-09',
      })

      // Consultar Dashboard Summary
      const summaryRes = await request(app)
        .get('/api/dashboard/summary?period=2026-09')
        .set(authHeaders)

      expect(summaryRes.status).toBe(200)
      const data = summaryRes.body.data

      expect(data.period).toBe('2026-09')
      expect(data.totalIncome).toBe(100000)
      expect(data.totalExpenses).toBe(20000)
      expect(data.cashWithdrawals).toBe(5000)
      expect(data.netCashFlow).toBe(75000) // 100000 - 20000 - 5000
      expect(data.carryOver).toBe(50000) // Arrastre de Agosto
      expect(data.availableBalance).toBe(125000) // 75000 + 50000
      expect(data.committedDebts).toBe(3000)
      expect(data.unencumberedLiquidity).toBe(122000) // 125000 - 3000
      expect(data.savingsRatePercentage).toBe(75) // 75000 / 100000 * 100
      expect(data.healthScore).toBe('EXCELLENT')
      expect(data.advisorAdvice.length).toBeGreaterThan(0)
    })
  })
})
