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

export const sentinelRouter = Router()

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
