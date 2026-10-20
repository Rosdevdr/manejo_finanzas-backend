// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: POSTGRESQL IDENTITY REPOSITORY
// ==============================================================================

import type pg from 'pg'
import type { IIdentityRepository, UserIdentity } from '../../domain/ports/identity-repository.port.js'
import type { ChannelProvider } from '../../domain/entities/inbox-event.entity.js'
import { getDbExecutor } from '../../../../shared/infrastructure/persistence/unit-of-work.js'
import { getDbPool } from '../../../../shared/infrastructure/persistence/postgres.pool.js'

export class PgIdentityRepository implements IIdentityRepository {
  private get client(): pg.Pool | pg.PoolClient {
    return getDbExecutor() || getDbPool()
  }

  public async findUserByChannel(
    provider: ChannelProvider,
    externalUserId: string
  ): Promise<UserIdentity | null> {
    const query = `
      SELECT u.id AS user_id, u.household_id, u.full_name, h.default_currency AS currency
      FROM identity_channels ic
      JOIN users u ON u.id = ic.user_id
      JOIN households h ON h.id = u.household_id
      WHERE ic.provider = $1 AND ic.external_user_id = $2
      LIMIT 1;
    `

    const res = await this.client.query(query, [provider, externalUserId])
    if (res.rows.length === 0) return null

    const row = res.rows[0]
    return {
      userId: row.user_id,
      householdId: row.household_id,
      fullName: row.full_name,
      currency: row.currency,
    }
  }

  public async findOrCreateUserForChannel(
    provider: ChannelProvider,
    externalUserId: string,
    fullName: string = 'Usuario Aureus'
  ): Promise<UserIdentity> {
    const existing = await this.findUserByChannel(provider, externalUserId)
    if (existing) return existing

    // 1. Obtener o crear hogar por defecto
    const householdRes = await this.client.query(`
      INSERT INTO households (name, default_currency)
      VALUES ($1, 'DOP')
      RETURNING id, default_currency;
    `, ['Hogar Aureus'])

    const householdId = householdRes.rows[0].id
    const currency = householdRes.rows[0].default_currency

    // 2. Crear usuario como admin
    const userRes = await this.client.query(`
      INSERT INTO users (household_id, full_name, role)
      VALUES ($1, $2, 'admin')
      RETURNING id, full_name;
    `, [householdId, fullName])

    const userId = userRes.rows[0].id

    // 3. Vincular canal externo
    await this.client.query(`
      INSERT INTO identity_channels (user_id, provider, external_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (provider, external_user_id) DO NOTHING;
    `, [userId, provider, externalUserId])

    return {
      userId,
      householdId,
      fullName: userRes.rows[0].full_name,
      currency,
    }
  }
}
