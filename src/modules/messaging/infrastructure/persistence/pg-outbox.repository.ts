// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: POSTGRESQL OUTBOX REPOSITORY
// ==============================================================================

import type pg from 'pg'
import type { IOutboxRepository } from '../../domain/ports/outbox-repository.port.js'
import {
  OutboxMessage,
  type OutboxStatus,
  type OutboxMessageType,
} from '../../domain/entities/outbox-message.entity.js'
import type { ChannelProvider } from '../../domain/entities/inbox-event.entity.js'
import { getDbExecutor } from '../../../../shared/infrastructure/persistence/unit-of-work.js'
import { getDbPool } from '../../../../shared/infrastructure/persistence/postgres.pool.js'

interface OutboxRow {
  id: string
  source_event_id: string | null
  provider: ChannelProvider
  recipient_id: string
  message_type: OutboxMessageType
  payload: Record<string, unknown>
  status: OutboxStatus
  retry_count: number
  max_retries: number
  locked_until: Date | null
  next_attempt_at: Date
  last_error: string | null
  created_at: Date
  sent_at: Date | null
}

export class PgOutboxRepository implements IOutboxRepository {
  constructor(private readonly pool: pg.Pool = getDbPool()) {}

  public async enqueue(message: OutboxMessage): Promise<void> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      INSERT INTO outbox_messages (
        id, source_event_id, provider, recipient_id, message_type,
        payload, status, retry_count, max_retries, locked_until,
        next_attempt_at, last_error, created_at, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `

    const values = [
      message.getId(),
      message.getSourceEventId(),
      message.getProvider(),
      message.getRecipientId(),
      message.getMessageType(),
      JSON.stringify(message.getPayload()),
      message.getStatus(),
      message.getRetryCount(),
      message.getMaxRetries(),
      message.getLockedUntil(),
      message.getNextAttemptAt(),
      message.getLastError(),
      message.getCreatedAt(),
      message.getSentAt(),
    ]

    await executor.query(sql, values)
  }

  public async claimPendingBatch(limit = 10, lockDurationSeconds = 60): Promise<OutboxMessage[]> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      UPDATE outbox_messages
      SET status = 'processing',
          locked_until = NOW() + ($2 || ' seconds')::INTERVAL
      WHERE id IN (
        SELECT id
        FROM outbox_messages
        WHERE (status = 'pending' OR (status = 'failed' AND next_attempt_at <= NOW()))
          AND (locked_until IS NULL OR locked_until <= NOW())
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, source_event_id, provider, recipient_id, message_type,
                payload, status, retry_count, max_retries, locked_until,
                next_attempt_at, last_error, created_at, sent_at
    `

    const res = await executor.query<OutboxRow>(sql, [limit, lockDurationSeconds])
    return res.rows.map(row => this.mapToEntity(row))
  }

  public async update(message: OutboxMessage): Promise<void> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      UPDATE outbox_messages
      SET status = $2,
          retry_count = $3,
          locked_until = $4,
          next_attempt_at = $5,
          last_error = $6,
          sent_at = $7
      WHERE id = $1
    `

    const values = [
      message.getId(),
      message.getStatus(),
      message.getRetryCount(),
      message.getLockedUntil(),
      message.getNextAttemptAt(),
      message.getLastError(),
      message.getSentAt(),
    ]

    await executor.query(sql, values)
  }

  public async findById(id: string): Promise<OutboxMessage | null> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      SELECT id, source_event_id, provider, recipient_id, message_type,
             payload, status, retry_count, max_retries, locked_until,
             next_attempt_at, last_error, created_at, sent_at
      FROM outbox_messages
      WHERE id = $1
    `

    const res = await executor.query<OutboxRow>(sql, [id])
    if (res.rows.length === 0) return null

    return this.mapToEntity(res.rows[0])
  }

  private mapToEntity(row: OutboxRow): OutboxMessage {
    const payload =
      typeof row.payload === 'string'
        ? JSON.parse(row.payload)
        : row.payload

    return OutboxMessage.reconstitute({
      id: row.id,
      sourceEventId: row.source_event_id,
      provider: row.provider,
      recipientId: row.recipient_id,
      messageType: row.message_type,
      payload: payload || {},
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
      nextAttemptAt: new Date(row.next_attempt_at),
      lastError: row.last_error,
      createdAt: new Date(row.created_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
    })
  }
}
