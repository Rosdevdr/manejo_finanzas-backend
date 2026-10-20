import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgIdentityRepository } from '../../src/modules/messaging/infrastructure/persistence/pg-identity.repository.js'

describe('PgIdentityRepository', () => {
  let mockClient: any
  let repo: PgIdentityRepository

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    }
    repo = new PgIdentityRepository()
    // Inyectamos el mock client en el getter
    Object.defineProperty(repo, 'client', {
      get: () => mockClient,
      configurable: true,
    })
  })

  it('retorna null si no encuentra un canal vinculado', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] })

    const result = await repo.findUserByChannel('telegram', '999888')

    expect(result).toBeNull()
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM identity_channels ic'),
      ['telegram', '999888']
    )
  })

  it('retorna UserIdentity si el canal ya existe', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-uuid-1',
          household_id: 'household-uuid-1',
          full_name: 'Ana Pérez',
          currency: 'DOP',
        },
      ],
    })

    const result = await repo.findUserByChannel('telegram', '999888')

    expect(result).toEqual({
      userId: 'user-uuid-1',
      householdId: 'household-uuid-1',
      fullName: 'Ana Pérez',
      currency: 'DOP',
    })
  })

  it('crea hogar, usuario y canal si no existe previamente', async () => {
    // 1. findUserByChannel retorna null
    mockClient.query.mockResolvedValueOnce({ rows: [] })
    // 2. INSERT into households
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'new-household-uuid', default_currency: 'DOP' }],
    })
    // 3. INSERT into users
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'new-user-uuid', full_name: 'Carlos' }],
    })
    // 4. INSERT into identity_channels
    mockClient.query.mockResolvedValueOnce({ rows: [] })

    const result = await repo.findOrCreateUserForChannel('telegram', '12345', 'Carlos')

    expect(result).toEqual({
      userId: 'new-user-uuid',
      householdId: 'new-household-uuid',
      fullName: 'Carlos',
      currency: 'DOP',
    })
    expect(mockClient.query).toHaveBeenCalledTimes(4)
  })
})
