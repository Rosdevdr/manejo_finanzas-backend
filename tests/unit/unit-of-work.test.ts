import { describe, it, expect, vi, beforeEach } from 'vitest'
import type pg from 'pg'
import { PgUnitOfWork, getDbExecutor, txStore } from '../../src/shared/infrastructure/persistence/unit-of-work.js'

describe('Infrastructure: PgUnitOfWork con AsyncLocalStorage', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>
    release: ReturnType<typeof vi.fn>
  }
  let mockPool: {
    connect: ReturnType<typeof vi.fn>
    query: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    }
  })

  it('debe ejecutar BEGIN, el trabajo, COMMIT y liberar el cliente ante éxito', async () => {
    const uow = new PgUnitOfWork(mockPool as unknown as pg.Pool)

    const result = await uow.execute(async () => {
      // Verificar que getDbExecutor entrega el cliente transaccional dentro del bloque
      const executor = getDbExecutor(mockPool as unknown as pg.Pool)
      expect(executor).toBe(mockClient)
      return 'OK_RESULT'
    })

    expect(result).toBe('OK_RESULT')
    expect(mockPool.connect).toHaveBeenCalledTimes(1)
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'COMMIT')
    expect(mockClient.release).toHaveBeenCalledTimes(1)

    // Fuera de la transacción, getDbExecutor vuelve a entregar el pool
    const outsideExecutor = getDbExecutor(mockPool as unknown as pg.Pool)
    expect(outsideExecutor).toBe(mockPool)
  })

  it('debe ejecutar ROLLBACK y liberar el cliente si el trabajo arroja una excepción', async () => {
    const uow = new PgUnitOfWork(mockPool as unknown as pg.Pool)

    await expect(
      uow.execute(async () => {
        throw new Error('Database write error')
      })
    ).rejects.toThrow('Database write error')

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK')
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  it('debe soportar bloques anidados reutilizando la misma transacción sin emitir BEGIN duplicado', async () => {
    const uow = new PgUnitOfWork(mockPool as unknown as pg.Pool)

    const result = await uow.execute(async () => {
      return await uow.execute(async () => {
        return 'NESTED_SUCCESS'
      })
    })

    expect(result).toBe('NESTED_SUCCESS')
    // Solo debe haber un connect, un BEGIN y un COMMIT
    expect(mockPool.connect).toHaveBeenCalledTimes(1)
    expect(mockClient.query).toHaveBeenCalledTimes(2)
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'COMMIT')
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })
})
