// ==============================================================================
// 🏛️ AUREUS · DOMAIN ENTITY: OUTBOX MESSAGE (ENTREGA AT-LEAST-ONCE)
// ==============================================================================

import { DomainError } from '../../../../shared/domain/errors/domain.error.js'
import type { ChannelProvider } from './inbox-event.entity.js'

export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
export type OutboxMessageType = 'text' | 'interactive'

export class InvalidOutboxMessageError extends DomainError {
  constructor(message: string) {
    super(`[OutboxMessage] ${message}`)
  }
}

export interface CreateOutboxMessageProps {
  id?: string
  sourceEventId?: string | null
  provider: ChannelProvider
  recipientId: string
  messageType?: OutboxMessageType
  payload: Record<string, unknown>
  maxRetries?: number
  createdAt?: Date
}

export interface ReconstituteOutboxMessageProps {
  id: string
  sourceEventId: string | null
  provider: ChannelProvider
  recipientId: string
  messageType: OutboxMessageType
  payload: Record<string, unknown>
  status: OutboxStatus
  retryCount: number
  maxRetries: number
  lockedUntil: Date | null
  nextAttemptAt: Date
  lastError: string | null
  createdAt: Date
  sentAt: Date | null
}

export class OutboxMessage {
  private readonly id: string
  private readonly sourceEventId: string | null
  private readonly provider: ChannelProvider
  private readonly recipientId: string
  private readonly messageType: OutboxMessageType
  private readonly payload: Record<string, unknown>
  private status: OutboxStatus
  private retryCount: number
  private readonly maxRetries: number
  private lockedUntil: Date | null
  private nextAttemptAt: Date
  private lastError: string | null
  private readonly createdAt: Date
  private sentAt: Date | null

  private constructor(props: ReconstituteOutboxMessageProps) {
    if (!props.id) throw new InvalidOutboxMessageError('El ID del mensaje es requerido')
    if (!props.recipientId) throw new InvalidOutboxMessageError('recipientId es requerido')
    if (!props.payload) throw new InvalidOutboxMessageError('El payload es requerido')

    this.id = props.id
    this.sourceEventId = props.sourceEventId
    this.provider = props.provider
    this.recipientId = props.recipientId
    this.messageType = props.messageType
    this.payload = props.payload
    this.status = props.status
    this.retryCount = props.retryCount
    this.maxRetries = props.maxRetries
    this.lockedUntil = props.lockedUntil
    this.nextAttemptAt = props.nextAttemptAt
    this.lastError = props.lastError
    this.createdAt = props.createdAt
    this.sentAt = props.sentAt
  }

  public static create(props: CreateOutboxMessageProps): OutboxMessage {
    return new OutboxMessage({
      id: props.id || crypto.randomUUID(),
      sourceEventId: props.sourceEventId ?? null,
      provider: props.provider,
      recipientId: props.recipientId,
      messageType: props.messageType ?? 'text',
      payload: props.payload,
      status: 'pending',
      retryCount: 0,
      maxRetries: props.maxRetries ?? 5,
      lockedUntil: null,
      nextAttemptAt: new Date(),
      lastError: null,
      createdAt: props.createdAt ?? new Date(),
      sentAt: null,
    })
  }

  public static reconstitute(props: ReconstituteOutboxMessageProps): OutboxMessage {
    return new OutboxMessage(props)
  }

  // --- Transiciones ---

  public markSent(): void {
    this.status = 'sent'
    this.sentAt = new Date()
    this.lockedUntil = null
    this.lastError = null
  }

  public markFailed(error: string, backoffSeconds = 30): void {
    this.retryCount += 1
    this.lastError = error
    this.lockedUntil = null

    if (this.retryCount >= this.maxRetries) {
      this.status = 'dead'
    } else {
      this.status = 'failed'
      // Backoff exponencial simple: backoff * (2 ^ attempt)
      const delay = backoffSeconds * Math.pow(2, this.retryCount - 1) * 1000
      this.nextAttemptAt = new Date(Date.now() + delay)
    }
  }

  public claim(lockDurationSeconds = 60): void {
    this.status = 'processing'
    this.lockedUntil = new Date(Date.now() + lockDurationSeconds * 1000)
  }

  // --- Getters ---
  public getId(): string { return this.id }
  public getSourceEventId(): string | null { return this.sourceEventId }
  public getProvider(): ChannelProvider { return this.provider }
  public getRecipientId(): string { return this.recipientId }
  public getMessageType(): OutboxMessageType { return this.messageType }
  public getPayload(): Record<string, unknown> { return this.payload }
  public getStatus(): OutboxStatus { return this.status }
  public getRetryCount(): number { return this.retryCount }
  public getMaxRetries(): number { return this.maxRetries }
  public getLockedUntil(): Date | null { return this.lockedUntil }
  public getNextAttemptAt(): Date { return this.nextAttemptAt }
  public getLastError(): string | null { return this.lastError }
  public getCreatedAt(): Date { return this.createdAt }
  public getSentAt(): Date | null { return this.sentAt }
}
