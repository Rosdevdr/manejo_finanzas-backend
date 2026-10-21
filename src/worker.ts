// ==============================================================================
// 🏛️ AUREUS · WORKER RUNNER: STANDALONE BACKGROUND DAEMON
// ==============================================================================

import { PgOutboxRepository } from './modules/messaging/infrastructure/persistence/pg-outbox.repository.js'
import { TelegramMessengerService } from './modules/messaging/infrastructure/telegram/telegram-messenger.service.js'
import { OutboxDispatcherWorker } from './modules/messaging/application/workers/outbox-dispatcher.worker.js'
import { PgSentinelRepository } from './modules/sentinel/infrastructure/persistence/pg-sentinel.repository.js'
import { PgIdentityRepository } from './modules/messaging/infrastructure/persistence/pg-identity.repository.js'
import { SentinelScanUseCase } from './modules/sentinel/application/use-cases/sentinel-scan.use-case.js'
import {
  BackgroundDaemonService,
  extractErrorMessage,
} from './modules/messaging/application/workers/background-daemon.service.js'
import { getDbPool } from './shared/infrastructure/persistence/postgres.pool.js'
import { env } from './config/env.js'

async function bootstrap() {
  const pool = getDbPool()
  let dbStatus = 'Verificando...'
  let dbErrorDetail: string | null = null

  try {
    await pool.query('SELECT 1')
    dbStatus = 'Activa y verificada (PostgreSQL OK)'
  } catch (err: unknown) {
    dbStatus = 'Inactiva (Sin conexión a PostgreSQL)'
    dbErrorDetail = extractErrorMessage(err)
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🛡️ AUREUS Background Daemon & Sentinel Anti-Moras             ║
║  🚀 Ambiente: ${env.NODE_ENV.padEnd(49)}║
║  📡 Conexión DB: ${dbStatus.padEnd(45)}║
╚════════════════════════════════════════════════════════════════╝
`)

  if (dbErrorDetail) {
    console.warn('⚠️  AVISO DE CONEXIÓN A BASE DE DATOS:')
    console.warn(`   Detalle del error: ${dbErrorDetail}`)
    console.warn(`   DATABASE_URL actual: ${env.DATABASE_URL ? env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : '(no configurada)'}`)
    console.warn('')
    console.warn('💡 ¿Cómo solucionar este error?')
    console.warn('   1. Asegúrate de tener el archivo "backend/.env".')
    console.warn('   2. Configura tu cadena de conexión PostgreSQL en DATABASE_URL:')
    console.warn('      • Si usas Supabase:')
    console.warn('        DATABASE_URL=postgresql://postgres:[TU_PASSWORD]@db.[REF].supabase.co:5432/postgres')
    console.warn('      • Si usas PostgreSQL local:')
    console.warn('        DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres')
    console.warn('   3. El demonio continuará ejecutándose y reintentará automáticamente cuando la base de datos esté lista.\n')
  }

  const outboxRepo = new PgOutboxRepository(pool)
  const messengerService = new TelegramMessengerService()
  const outboxWorker = new OutboxDispatcherWorker(outboxRepo, messengerService)

  const sentinelRepo = new PgSentinelRepository(pool)
  const identityRepo = new PgIdentityRepository(pool)
  const sentinelScanUseCase = new SentinelScanUseCase(sentinelRepo, identityRepo, outboxRepo)

  const daemon = new BackgroundDaemonService(outboxWorker, sentinelScanUseCase, {
    outboxPollIntervalMs: 2500, // Cada 2.5s revisa mensajes pendientes en Outbox
    sentinelScanIntervalMs: 3600000, // Cada 1h escanea compromisos y facturas por vencer
  })

  daemon.start()

  // Cierre ordenado (Graceful Shutdown)
  const shutdown = async () => {
    console.log('\n🛑 Deteniendo demonio AUREUS...')
    daemon.stop()
    try {
      await pool.end()
    } catch {
      // Ignorar error al cerrar pool
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((err) => {
  console.error('💥 Error crítico en worker:', err)
  process.exit(1)
})
