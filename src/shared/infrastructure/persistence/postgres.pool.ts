// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: POSTGRESQL POOL PROVIDER
// ==============================================================================

import pg from 'pg'
import { env } from '../../../config/env.js'

const { Pool } = pg

let globalPool: pg.Pool | null = null

export function getDbPool(): pg.Pool {
  if (!globalPool) {
    const isProduction = env.NODE_ENV === 'production'
    const connectionString = env.DATABASE_URL

    const isSupabase =
      connectionString?.includes('supabase.co') || connectionString?.includes('supabase.com')

    globalPool = new Pool({
      connectionString,
      ssl: isProduction || isSupabase ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    globalPool.on('error', (err) => {
      console.error('⚠️ Error inesperado en el cliente inactivo de PostgreSQL:', err.message)
    })
  }

  return globalPool
}

export async function closeDbPool(): Promise<void> {
  if (globalPool) {
    await globalPool.end()
    globalPool = null
  }
}
