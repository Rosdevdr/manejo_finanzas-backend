// ==============================================================================
// 🏛️ AUREUS · WORKER RUNNER: STANDALONE BACKGROUND DAEMON
// ==============================================================================

import { PgOutboxRepository } from './modules/messaging/infrastructure/persistence/pg-outbox.repository.js'
import { TelegramMessengerService } from './modules/messaging/infrastructure/telegram/telegram-messenger.service.js'
import { OutboxDispatcherWorker } from './modules/messaging/application/workers/outbox-dispatcher.worker.js'
import { PgSentinelRepository } from './modules/sentinel/infrastructure/persistence/pg-sentinel.repository.js'
import { PgIdentityRepository } from './modules/messaging/infrastructure/persistence/pg-identity.repository.js'
import { SentinelScanUseCase } from './modules/sentinel/application/use-cases/sentinel-scan.use-case.js'
import { BackgroundDaemonService } from './modules/messaging/application/workers/background-daemon.service.js'
import { env } from './config/env.js'

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🛡️ AUREUS Background Daemon & Sentinel Anti-Moras             ║
║  🚀 Ambiente: ${env.NODE_ENV.padEnd(49)}║
║  📡 Conexión DB: Activa                                        ║
╚════════════════════════════════════════════════════════════════╝
`)

const outboxRepo = new PgOutboxRepository()
const messengerService = new TelegramMessengerService()
const outboxWorker = new OutboxDispatcherWorker(outboxRepo, messengerService)

const sentinelRepo = new PgSentinelRepository()
const identityRepo = new PgIdentityRepository()
const sentinelScanUseCase = new SentinelScanUseCase(sentinelRepo, identityRepo, outboxRepo)

const daemon = new BackgroundDaemonService(outboxWorker, sentinelScanUseCase, {
  outboxPollIntervalMs: 2500, // Cada 2.5s revisa mensajes pendientes en Outbox
  sentinelScanIntervalMs: 3600000, // Cada 1h escanea compromisos y facturas por vencer
})

daemon.start()

// Cierre ordenado (Graceful Shutdown)
const shutdown = () => {
  console.log('\n🛑 Deteniendo demonio AUREUS...')
  daemon.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
