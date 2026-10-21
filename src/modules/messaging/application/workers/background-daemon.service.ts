// ==============================================================================
// 🏛️ AUREUS · APPLICATION WORKER: BACKGROUND DAEMON & SCHEDULER
// ==============================================================================

import type { OutboxDispatcherWorker } from './outbox-dispatcher.worker.js'
import type { SentinelScanUseCase } from '../../../sentinel/application/use-cases/sentinel-scan.use-case.js'

export interface BackgroundDaemonConfig {
  outboxPollIntervalMs?: number // Default: 2500ms
  sentinelScanIntervalMs?: number // Default: 1 hora (3600000ms)
}

export function extractErrorMessage(err: unknown): string {
  if (!err) return 'Error desconocido'
  if (err instanceof Error) {
    if (err.message && err.message.trim().length > 0) return err.message
    const maybeCode = (err as Record<string, unknown>).code
    const maybeErrors = (err as Record<string, unknown>).errors
    if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
      return maybeErrors
        .map(e => (e instanceof Error ? e.message : (e as Record<string, unknown>)?.message || (e as Record<string, unknown>)?.code || String(e)))
        .join(', ')
    }
    if (maybeCode) return `Fallo de conexión (${maybeCode})`
    return err.name || 'Error desconocido'
  }
  if (typeof err === 'object') {
    const errObj = err as Record<string, unknown>
    if (typeof errObj.message === 'string' && errObj.message) return errObj.message
    if (errObj.code) return `Fallo de conexión (${errObj.code})`
    return JSON.stringify(err)
  }
  return String(err)
}

export class BackgroundDaemonService {
  private isRunning = false
  private outboxTimer: NodeJS.Timeout | null = null
  private sentinelTimer: NodeJS.Timeout | null = null
  private isDispatching = false
  private isScanning = false
  private consecutiveOutboxErrors = 0
  private lastOutboxErrorMsg: string | null = null

  constructor(
    private readonly outboxWorker: OutboxDispatcherWorker,
    private readonly sentinelScanUseCase: SentinelScanUseCase,
    private readonly config: BackgroundDaemonConfig = {}
  ) {}

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true

    const outboxInterval = this.config.outboxPollIntervalMs ?? 2500
    const sentinelInterval = this.config.sentinelScanIntervalMs ?? 3600000

    console.log(`[AUREUS Daemon] Iniciando demonio en segundo plano...`)
    console.log(`  • Outbox Dispatcher: cada ${outboxInterval}ms`)
    console.log(`  • Centinela Anti-Moras: cada ${Math.round(sentinelInterval / 1000 / 60)} min`)

    // 1. Ejecutar escaneo inicial del Centinela al arranque
    this.runSentinelScanSafe().catch(() => {})

    // 2. Programar bucle de Outbox
    this.outboxTimer = setInterval(() => {
      this.runOutboxDispatchSafe().catch(() => {})
    }, outboxInterval)

    // 3. Programar bucle del Centinela
    this.sentinelTimer = setInterval(() => {
      this.runSentinelScanSafe().catch(() => {})
    }, sentinelInterval)
  }

  public stop(): void {
    if (!this.isRunning) return
    this.isRunning = false

    if (this.outboxTimer) {
      clearInterval(this.outboxTimer)
      this.outboxTimer = null
    }

    if (this.sentinelTimer) {
      clearInterval(this.sentinelTimer)
      this.sentinelTimer = null
    }

    console.log('[AUREUS Daemon] Demonio detenido ordenadamente.')
  }

  public getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Ejecuta una ronda de despacho de Outbox con protección contra concurrencia interna
   */
  public async runOutboxDispatchSafe(): Promise<{ dispatched: number }> {
    if (this.isDispatching) return { dispatched: 0 }
    this.isDispatching = true

    try {
      const result = await this.outboxWorker.dispatchPendingBatch(10)
      this.consecutiveOutboxErrors = 0
      this.lastOutboxErrorMsg = null

      if (result.sentCount > 0) {
        console.log(`[AUREUS Daemon] ${result.sentCount} mensaje(s) de outbox despachados exitosamente.`)
      }
      return { dispatched: result.sentCount }
    } catch (err: unknown) {
      this.consecutiveOutboxErrors++
      const errMsg = extractErrorMessage(err)

      // Throttle log: solo loguear el 1er error, cambios de mensaje, o cada 15 ciclos (para no inundar la consola)
      if (
        this.consecutiveOutboxErrors === 1 ||
        this.consecutiveOutboxErrors % 15 === 0 ||
        errMsg !== this.lastOutboxErrorMsg
      ) {
        const attemptsNotice = this.consecutiveOutboxErrors > 1 ? ` (${this.consecutiveOutboxErrors} intentos)` : ''
        console.error(`[AUREUS Daemon] Error en bucle de Outbox${attemptsNotice}:`, errMsg)
        this.lastOutboxErrorMsg = errMsg
      }
      return { dispatched: 0 }
    } finally {
      this.isDispatching = false
    }
  }

  /**
   * Ejecuta una ronda de escaneo del Centinela Anti-Moras
   */
  public async runSentinelScanSafe(): Promise<{ alertsGenerated: number }> {
    if (this.isScanning) return { alertsGenerated: 0 }
    this.isScanning = true

    try {
      const result = await this.sentinelScanUseCase.execute({
        asOfDate: new Date(),
        horizonDays: 7,
      })
      if (result.alertsGeneratedCount > 0) {
        console.log(`[AUREUS Daemon] Centinela generó ${result.alertsGeneratedCount} alerta(s) preventiva(s).`)
      }
      return { alertsGenerated: result.alertsGeneratedCount }
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err)
      console.error('[AUREUS Daemon] Error en escaneo Centinela:', errMsg)
      return { alertsGenerated: 0 }
    } finally {
      this.isScanning = false
    }
  }
}
