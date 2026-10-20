// ==============================================================================
// 🏛️ AUREUS · APPLICATION WORKER: BACKGROUND DAEMON & SCHEDULER
// ==============================================================================

import type { OutboxDispatcherWorker } from './outbox-dispatcher.worker.js'
import type { SentinelScanUseCase } from '../../../sentinel/application/use-cases/sentinel-scan.use-case.js'

export interface BackgroundDaemonConfig {
  outboxPollIntervalMs?: number // Default: 2500ms
  sentinelScanIntervalMs?: number // Default: 1 hora (3600000ms)
}

export class BackgroundDaemonService {
  private isRunning = false
  private outboxTimer: NodeJS.Timeout | null = null
  private sentinelTimer: NodeJS.Timeout | null = null
  private isDispatching = false
  private isScanning = false

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
      if (result.sentCount > 0) {
        console.log(`[AUREUS Daemon] ${result.sentCount} mensaje(s) de outbox despachados exitosamente.`)
      }
      return { dispatched: result.sentCount }
    } catch (err: unknown) {
      console.error('[AUREUS Daemon] Error en bucle de Outbox:', (err as Error).message)
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
      console.error('[AUREUS Daemon] Error en escaneo Centinela:', (err as Error).message)
      return { alertsGenerated: 0 }
    } finally {
      this.isScanning = false
    }
  }
}
