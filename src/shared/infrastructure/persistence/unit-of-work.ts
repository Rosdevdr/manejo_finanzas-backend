// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: UNIT OF WORK CON ASYNC-LOCAL-STORAGE
// ==============================================================================

import { AsyncLocalStorage } from 'node:async_hooks'
import type pg from 'pg'
import type { IUnitOfWork } from '../../application/ports/unit-of-work.port.js'
import { getDbPool } from './postgres.pool.js'

/**
 * Almacenamiento local asíncrono para propagar la conexión transaccional
 * sin contaminar las firmas de los repositorios o casos de uso.
 */
export const txStore = new AsyncLocalStorage<pg.PoolClient>()

/**
 * Obtiene el ejecutor de base de datos actual:
 * - Si estamos dentro de un bloque `unitOfWork.execute()`, devuelve el `PoolClient` con la transacción activa.
 * - Si estamos fuera de una transacción, devuelve el `Pool` global o el fallback proporcionado.
 */
export function getDbExecutor(fallbackPool?: pg.Pool): pg.Pool | pg.PoolClient {
  const activeTxClient = txStore.getStore()
  if (activeTxClient) {
    return activeTxClient
  }
  return fallbackPool ?? getDbPool()
}

export class PgUnitOfWork implements IUnitOfWork {
  constructor(private readonly pool: pg.Pool = getDbPool()) {}

  public async execute<T>(work: () => Promise<T>): Promise<T> {
    // Si ya existe una transacción activa en el contexto async (UoW anidado), reutilizarla
    const existingClient = txStore.getStore()
    if (existingClient) {
      return work()
    }

    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      const result = await txStore.run(client, work)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('⚠️ Fallo durante ROLLBACK de transacción:', (rollbackError as Error).message)
      }
      throw error
    } finally {
      client.release()
    }
  }
}
