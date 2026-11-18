// ==============================================================================
// 🛡️ AUREUS · ROUTES: SENTINEL ANTI-MORAS (API REST PARA DASHBOARD)
// ==============================================================================

import { Router } from 'express'
import { z } from 'zod'
import { PgSentinelRepository } from '../modules/sentinel/infrastructure/persistence/pg-sentinel.repository.js'
import { PgIdentityRepository } from '../modules/messaging/infrastructure/persistence/pg-identity.repository.js'
import { PgOutboxRepository } from '../modules/messaging/infrastructure/persistence/pg-outbox.repository.js'
import { RegisterCommitmentUseCase } from '../modules/sentinel/application/use-cases/register-commitment.use-case.js'
import { SentinelScanUseCase } from '../modules/sentinel/application/use-cases/sentinel-scan.use-case.js'
import { requireAuth } from '../middleware/auth.js'
import { sentinelService } from '../services/sentinel.service.js'

export const sentinelRouter = Router()

const userCommitmentSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'El nombre es requerido').max(60),
  contract_number: z.string().max(50).optional(),
  category: z.enum(['electric', 'telecom', 'card', 'education', 'water', 'other']).default('other'),
  amount: z.number().positive('El monto debe ser positivo'),
  late_fee_avoided: z.number().min(0).default(0),
  due_day: z.number().int().min(1).max(31),
  due_date_str: z.string().max(30).optional(),
  status: z.enum(['pending', 'paid', 'urgent']).default('pending'),
  paid_period: z.string().max(7).nullable().optional(),
})

const userCommitmentUpdateSchema = userCommitmentSchema.partial()

// ==============================================================================
// RUTAS MULTI-USUARIO AUTHENTICATED (THIN-CLIENT DASHBOARD / SUPABASE)
// ==============================================================================

sentinelRouter.get('/user/commitments', requireAuth, async (req, res) => {
  try {
    const items = await sentinelService.list(req.userId!)
    res.json({ status: 'success', data: items })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

sentinelRouter.post('/user/commitments', requireAuth, async (req, res) => {
  try {
    const parsed = userCommitmentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ status: 'fail', errors: parsed.error.format() })
      return
    }
    const created = await sentinelService.create(req.userId!, parsed.data)
    res.status(201).json({ status: 'success', data: created })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

sentinelRouter.patch('/user/commitments/:id', requireAuth, async (req, res) => {
  try {
    const parsed = userCommitmentUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ status: 'fail', errors: parsed.error.format() })
      return
    }
    const updated = await sentinelService.update(req.userId!, req.params.id, parsed.data)
    if (!updated) {
      res.status(404).json({ status: 'fail', error: 'Compromiso no encontrado' })
      return
    }
    res.json({ status: 'success', data: updated })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

sentinelRouter.post('/user/commitments/:id/pay', requireAuth, async (req, res) => {
  try {
    const paidPeriod = typeof req.body?.paid_period === 'string' ? req.body.paid_period : undefined
    const updated = await sentinelService.markPaid(req.userId!, req.params.id, paidPeriod)
    if (!updated) {
      res.status(404).json({ status: 'fail', error: 'Compromiso no encontrado' })
      return
    }
    res.json({ status: 'success', data: updated })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

sentinelRouter.delete('/user/commitments/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await sentinelService.remove(req.userId!, req.params.id)
    if (!deleted) {
      res.status(404).json({ status: 'fail', error: 'Compromiso no encontrado' })
      return
    }
    res.json({ status: 'success', message: 'Compromiso eliminado' })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

const sentinelRepo = new PgSentinelRepository()
const identityRepo = new PgIdentityRepository()
const outboxRepo = new PgOutboxRepository()

const registerUseCase = new RegisterCommitmentUseCase(sentinelRepo)
const scanUseCase = new SentinelScanUseCase(sentinelRepo, identityRepo, outboxRepo)

const registerCommitmentSchema = z.object({
  householdId: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre es requerido'),
  categoryId: z.string().uuid().optional().nullable(),
  expectedAmount: z.union([z.string(), z.number()]).optional(),
  currency: z.enum(['DOP', 'USD']).default('DOP'),
  dueDayOfMonth: z.number().int().min(1).max(31),
  gracePeriodDays: z.number().int().min(0).default(0),
  estimatedLateFee: z.union([z.string(), z.number()]).default('0'),
  reminderDaysBefore: z.array(z.number().int()).default([5, 2, 0]),
})

// GET /api/sentinel/commitments - Listar compromisos activos del hogar
sentinelRouter.get('/commitments', async (req, res) => {
  try {
    const householdId = (req.query.householdId as string) || '11111111-1111-4111-a111-111111111111'
    const commitments = await sentinelRepo.listActiveCommitments(householdId)

    const now = new Date()
    const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

    // Mapear con ciclo activo
    const results = await Promise.all(
      commitments.map(async c => {
        const cycle = await sentinelRepo.findOrCreateCycle(c, currentPeriod)
        return {
          id: c.getId(),
          name: c.getName(),
          expectedAmount: c.getExpectedAmount() ? c.getExpectedAmount()!.format() : 'Monto variable',
          expectedAmountCents: c.getExpectedAmount() ? c.getExpectedAmount()!.getCents() : null,
          currency: c.getCurrency(),
          dueDayOfMonth: c.getDueDayOfMonth(),
          estimatedLateFee: c.getEstimatedLateFee().format(),
          estimatedLateFeeCents: c.getEstimatedLateFee().getCents(),
          reminderDaysBefore: c.getReminderDaysBefore(),
          currentCycle: {
            id: cycle.getId(),
            billingPeriod: cycle.getBillingPeriod(),
            dueDate: cycle.getDueDate().toISOString().split('T')[0],
            status: cycle.getStatus(),
            paidAt: cycle.getPaidAt()?.toISOString() || null,
            alertsSentCount: cycle.getAlertsSentCount(),
          },
        }
      })
    )

    res.json({
      status: 'success',
      data: {
        currentPeriod,
        commitments: results,
      },
    })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

// POST /api/sentinel/commitments - Registrar un nuevo compromiso
sentinelRouter.post('/commitments', async (req, res) => {
  try {
    const parsed = registerCommitmentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ status: 'fail', errors: parsed.error.format() })
      return
    }

    const householdId = parsed.data.householdId || '11111111-1111-4111-a111-111111111111'

    const result = await registerUseCase.execute({
      ...parsed.data,
      householdId,
    })

    res.status(201).json({
      status: 'success',
      data: result,
    })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

// POST /api/sentinel/scan - Disparar escaneo manual de alertas
sentinelRouter.post('/scan', async (req, res) => {
  try {
    const result = await scanUseCase.execute({
      asOfDate: new Date(),
      horizonDays: 7,
    })

    res.json({
      status: 'success',
      data: result,
    })
  } catch (err: unknown) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})
