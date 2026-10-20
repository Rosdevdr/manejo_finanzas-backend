import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackgroundDaemonService } from '../../src/modules/messaging/application/workers/background-daemon.service.js'
import type { OutboxDispatcherWorker } from '../../src/modules/messaging/application/workers/outbox-dispatcher.worker.js'
import type { SentinelScanUseCase } from '../../src/modules/sentinel/application/use-cases/sentinel-scan.use-case.js'

describe('BackgroundDaemonService', () => {
  let mockOutboxWorker: OutboxDispatcherWorker
  let mockSentinelScanUseCase: SentinelScanUseCase
  let daemon: BackgroundDaemonService

  beforeEach(() => {
    vi.useFakeTimers()

    mockOutboxWorker = {
      dispatchPendingBatch: vi.fn().mockResolvedValue({
        claimedCount: 2,
        sentCount: 2,
        failedCount: 0,
      }),
    } as any

    mockSentinelScanUseCase = {
      execute: vi.fn().mockResolvedValue({
        scannedCount: 5,
        alertsGeneratedCount: 1,
      }),
    } as any

    daemon = new BackgroundDaemonService(mockOutboxWorker, mockSentinelScanUseCase, {
      outboxPollIntervalMs: 1000,
      sentinelScanIntervalMs: 10000,
    })
  })

  afterEach(() => {
    daemon.stop()
    vi.useRealTimers()
  })

  it('inicia y detiene el demonio correctamente', () => {
    expect(daemon.getIsRunning()).toBe(false)
    daemon.start()
    expect(daemon.getIsRunning()).toBe(true)

    daemon.stop()
    expect(daemon.getIsRunning()).toBe(false)
  })

  it('ejecuta el escaneo inicial del Centinela al arrancar', () => {
    daemon.start()
    expect(mockSentinelScanUseCase.execute).toHaveBeenCalledTimes(1)
  })

  it('dispara el bucle de Outbox en los intervalos configurados', async () => {
    daemon.start()

    // Avanzamos 2500ms (2 ciclos de 1000ms)
    await vi.advanceTimersByTimeAsync(2500)

    expect(mockOutboxWorker.dispatchPendingBatch).toHaveBeenCalled()
  })

  it('protege contra ejecuciones concurrentes en caso de latencia de red', async () => {
    let resolveFirstDispatch: () => void
    const longRunningDispatch = new Promise<any>(resolve => {
      resolveFirstDispatch = () => resolve({ claimedCount: 1, sentCount: 1, failedCount: 0 })
    })

    vi.mocked(mockOutboxWorker.dispatchPendingBatch).mockReturnValueOnce(longRunningDispatch)

    // Primera llamada (se queda esperando)
    const call1 = daemon.runOutboxDispatchSafe()
    // Segunda llamada inmediata mientras call1 sigue activa
    const call2 = daemon.runOutboxDispatchSafe()

    const res2 = await call2
    expect(res2.dispatched).toBe(0) // Se omitió por guardia de concurrencia

    resolveFirstDispatch!()
    const res1 = await call1
    expect(res1.dispatched).toBe(1)
  })
})
