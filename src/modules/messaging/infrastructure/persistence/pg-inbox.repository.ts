// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: POSTGRESQL INBOX REPOSITORY
// ==============================================================================

import type pg from 'pg'
import type { IInboxRepository, SaveRawEventResult } from '../../domain/ports/inbox-repository.port.js'
import {
  InboxEvent,
  type ChannelProvider,
  type MessageType,
  type InboxStatus,
} from '../../domain/entities/inbox-event.entity.js'
import { getDbExecutor } from '../../../../shared/infrastructure/persistence/unit-of-work.js'
import { getDbPool } from '../../../../shared/infrastructure/persistence/postgres.pool.js'

interface InboxRow {
  id: string
  provider: ChannelProvider
  external_update_id: string | null
  external_chat_id: string
  external_message_id: string
  sender_id: string
  message_type: MessageType
  raw_payload: Record<string, unknown>
  status: InboxStatus
  error_message: string | null
  extracted_data: Record<string, unknown> | null
  ai_model: string | null
  prompt_version: string | null
  confidence_score: string | number | null
  created_at: Date
  processed_at: Date | null
}

export class PgInboxRepository implements IInboxRepository {
  constructor(private readonly pool: pg.Pool = getDbPool()) {}

  public async saveRawEvent(event: InboxEvent): Promise<SaveRawEventResult> {
    const executor = getDbExecutor(this.pool)

    const insertSql = `
      INSERT INTO inbox_events (
        id, provider, external_update_id, external_chat_id, external_message_id,
        sender_id, message_type, raw_payload, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (provider, external_chat_id, external_message_id) DO NOTHING
      RETURNING id
    `

    const values = [
      event.getId(),
      event.getProvider(),
      event.getExternalUpdateId(),
      event.getExternalChatId(),
      event.getExternalMessageId(),
      event.getSenderId(),
      event.getMessageType(),
      JSON.stringify(event.getRawPayload()),
      event.getStatus(),
      event.getCreatedAt(),
    ]

    const insertRes = await executor.query<{ id: string }>(insertSql, values)

    if (insertRes.rows.length > 0) {
      return { inserted: true, id: insertRes.rows[0].id }
    }

    // Si hubo conflicto (duplicado concurrente), recuperar el ID existente
    const selectSql = `
      SELECT id FROM inbox_events
      WHERE provider = $1 AND external_chat_id = $2 AND external_message_id = $3
      LIMIT 1
    `
    const selectRes = await executor.query<{ id: string }>(selectSql, [
      event.getProvider(),
      event.getExternalChatId(),
      event.getExternalMessageId(),
    ])

    return { inserted: false, id: selectRes.rows[0]?.id || event.getId() }
  }

  public async update(event: InboxEvent): Promise<void> {
    const executor = getDbExecutor(this.pool)

    const updateSql = `
      UPDATE inbox_events
      SET status = $2,
          error_message = $3,
          extracted_data = $4,
          ai_model = $5,
          prompt_version = $6,
          confidence_score = $7,
          processed_at = $8
      WHERE id = $1
    `

    const values = [
      event.getId(),
      event.getStatus(),
      event.getErrorMessage(),
      event.getExtractedData() ? JSON.stringify(event.getExtractedData()) : null,
      event.getAiModel(),
      event.getPromptVersion(),
      event.getConfidenceScore(),
      event.getProcessedAt(),
    ]

    await executor.query(updateSql, values)
  }

  public async findById(id: string): Promise<InboxEvent | null> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      SELECT id, provider, external_update_id, external_chat_id, external_message_id,
             sender_id, message_type, raw_payload, status, error_message,
             extracted_data, ai_model, prompt_version, confidence_score,
             created_at, processed_at
      FROM inbox_events
      WHERE id = $1
    `

    const res = await executor.query<InboxRow>(sql, [id])
    if (res.rows.length === 0) return null

    return this.mapToEntity(res.rows[0])
  }

  public async findByExternalMessage(
    provider: ChannelProvider,
    chatId: string,
    messageId: string
  ): Promise<InboxEvent | null> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      SELECT id, provider, external_update_id, external_chat_id, external_message_id,
             sender_id, message_type, raw_payload, status, error_message,
             extracted_data, ai_model, prompt_version, confidence_score,
             created_at, processed_at
      FROM inbox_events
      WHERE provider = $1 AND external_chat_id = $2 AND external_message_id = $3
      LIMIT 1
    `

    const res = await executor.query<InboxRow>(sql, [provider, chatId, messageId])
    if (res.rows.length === 0) return null

    return this.mapToEntity(res.rows[0])
  }

  public async claimForProcessing(id: string): Promise<boolean> {
    const executor = getDbExecutor(this.pool)

    const sql = `
      UPDATE inbox_events
      SET status = 'processed', processed_at = NOW()
      WHERE id = $1 AND status IN ('extracted', 'needs_review')
      RETURNING id
    `

    const res = await executor.query<{ id: string }>(sql, [id])
    return res.rows.length > 0
  }

  private mapToEntity(row: InboxRow): InboxEvent {
    const confidence =
      row.confidence_score !== null && row.confidence_score !== undefined
        ? parseFloat(String(row.confidence_score))
        : null

    const payload =
      typeof row.raw_payload === 'string'
        ? JSON.parse(row.raw_payload)
        : row.raw_payload

    const extracted =
      typeof row.extracted_data === 'string'
        ? JSON.parse(row.extracted_data)
        : row.extracted_data

    return InboxEvent.reconstitute({
      id: row.id,
      provider: row.provider,
      externalUpdateId: row.external_update_id,
      externalChatId: row.external_chat_id,
      externalMessageId: row.external_message_id,
      senderId: row.sender_id,
      messageType: row.message_type,
      rawPayload: payload || {},
      status: row.status,
      errorMessage: row.error_message,
      extractedData: extracted || null,
      aiModel: row.ai_model,
      promptVersion: row.prompt_version,
      confidenceScore: confidence,
      createdAt: new Date(row.created_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
    })
  }
}
