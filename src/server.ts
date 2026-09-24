import { app } from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════════╗
  ║  💰 AUREUS Financial Advisor - Dedicated Backend Service      ║
  ║  🚀 Servidor activo en: http://localhost:${env.PORT}                 ║
  ║  📡 Ambiente: ${env.NODE_ENV.padEnd(47)}║
  ║  🩺 Health check: http://localhost:${env.PORT}/api/health           ║
  ╚════════════════════════════════════════════════════════════════╝
  `)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Señal SIGTERM recibida: Cerrando servidor HTTP ordenadamente...')
  server.close(() => {
    console.log('✅ Servidor cerrado.')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('🛑 Señal SIGINT recibida: Cerrando servidor HTTP...')
  server.close(() => {
    console.log('✅ Servidor cerrado.')
    process.exit(0)
  })
})
