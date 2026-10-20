// ==============================================================================
// 🏛️ AUREUS · DOMAIN ENTITY: INBOX EVENT (INGESTA IDEMPOTENTE & AUDITORÍA)
// ==============================================================================

import { DomainError } from '../../../../shared/domain/errors/domain.error.js'

export type ChannelProvider = 'telegram' | 'whatsapp'
export type MessageType = 'text' | 'audio' | 'image'
export type InboxStatus = 'received' | 'extracted' | 'needs_review' | 'processed' | 'failed' | 'ignored'

export class InvalidInboxEventError extends DomainError {
  constructor(message: string) {
    super(`[InboxEvent] ${message}`)
  }
}

export interface CreateInboxEventProps {
  id?: string
  provider: ChannelProvider
  externalUpdateId?: string | null
  externalChatId: string
  externalMessageId: string
  senderId: string
  messageType: MessageType
  rawPayload: Record<string, unknown>
  createdAt?: Date
}

export interface ReconstituteInboxEventProps {
  id: string
  provider: ChannelProvider
  externalUpdateId: string | null
  externalChatId: string
  externalMessageId: string
  senderId: string
  messageType: MessageType
  rawPayload: Record<string, unknown>
  status: InboxStatus
  errorMessage: string | null
  extractedData: Record<string, unknown> | null
  aiModel: string | null
  promptVersion: string | null
  confidenceScore: number | null
  createdAt: Date
  processedAt: Date | null
}

export class InboxEvent {
  private readonly id: string
  private readonly provider: ChannelProvider
  private readonly externalUpdateId: string | null
  private readonly externalChatId: string
  private readonly externalMessageId: string
  private readonly senderId: string
  private readonly messageType: MessageType
  private readonly rawPayload: Record<string, unknown>
  private status: InboxStatus
  private errorMessage: string | null
  private extractedData: Record<string, unknown> | null
  private aiModel: string | null
  private promptVersion: string | null
  private confidenceScore: number | null
  private readonly createdAt: Date
  private processedAt: Date | null

  private constructor(props: ReconstituteInboxEventProps) {
    if (!props.id) throw new InvalidInboxEventError('El ID del evento es requerido')
    if (!props.externalChatId) throw new InvalidInboxEventError('externalChatId es requerido')
    if (!props.externalMessageId) throw new InvalidInboxEventError('externalMessageId es requerido')
    if (!props.senderId) throw new InvalidInboxEventError('senderId es requerido')

    this.id = props.id
    this.provider = props.provider
    this.externalUpdateId = props.externalUpdateId
    this.externalChatId = props.externalChatId
    this.externalMessageId = props.externalMessageId
    this.senderId = props.senderId
    this.messageType = props.messageType
    this.rawPayload = props.rawPayload
    this.status = props.status
    this.errorMessage = props.errorMessage
    this.extractedData = props.extractedData
    this.aiModel = props.aiModel
    this.promptVersion = props.promptVersion
    this.confidenceScore = props.confidenceScore
    this.createdAt = props.createdAt
    this.processedAt = props.processedAt
  }

  public static createReceived(props: CreateInboxEventProps): InboxEvent {
    return new InboxEvent({
      id: props.id || crypto.randomUUID(),
      provider: props.provider,
      externalUpdateId: props.externalUpdateId ?? null,
      externalChatId: props.externalChatId,
      externalMessageId: props.externalMessageId,
      senderId: props.senderId,
      messageType: props.messageType,
      rawPayload: props.rawPayload,
      status: 'received',
      errorMessage: null,
      extractedData: null,
      aiModel: null,
      promptVersion: null,
      confidenceScore: null,
      createdAt: props.createdAt ?? new Date(),
      processedAt: null,
    })
  }

  public static reconstitute(props: ReconstituteInboxEventProps): InboxEvent {
    return new InboxEvent(props)
  }

  // --- Transiciones de Estado ---

  public markExtracted(data: {
    extractedData: Record<string, unknown>
    aiModel: string
    promptVersion: string
    confidenceScore?: number | null
  }): void {
    if (this.status !== 'received' && this.status !== 'failed') {
      throw new InvalidInboxEventError(`No se puede marcar como extracted desde el estado "${this.status}"`)
    }
    this.status = 'extracted'
    this.extractedData = data.extractedData
    this.aiModel = data.aiModel
    this.promptVersion = data.promptVersion
    this.confidenceScore = data.confidenceScore ?? null
    this.errorMessage = null
  }

  public markNeedsReview(reason: string, partialData?: Record<string, unknown>): void {
    this.status = 'needs_review'
    this.errorMessage = reason
    if (partialData) this.extractedData = partialData
  }

  public markProcessed(): void {
    if (this.status !== 'extracted' && this.status !== 'needs_review') {
      throw new InvalidInboxEventError(`Solo eventos extracted o needs_review pueden procesarse. Estado actual: "${this.status}"`)
    }
    this.status = 'processed'
    this.processedAt = new Date()
  }

  public markFailed(error: string): void {
    this.status = 'failed'
    this.errorMessage = error
  }

  public markIgnored(reason: string): void {
    this.status = 'ignored'
    this.errorMessage = reason
  }

  // --- Getters ---
  public getId(): string { return this.id }
  public getProvider(): ChannelProvider { return this.provider }
  public getExternalUpdateId(): string | null { return this.externalUpdateId }
  public getExternalChatId(): string { return this.externalChatId }
  public getExternalMessageId(): string { return this.externalMessageId }
  public getSenderId(): string { return this.senderId }
  public getMessageType(): MessageType { return this.messageType }
  public getRawPayload(): Record<string, unknown> { return this.rawPayload }
  public getStatus(): InboxStatus { return this.status }
  public getErrorMessage(): string | null { return this.errorMessage }
  public getExtractedData(): Record<string, unknown> | null { return this.extractedData }
  public getAiModel(): string | null { return this.aiModel }
  public getPromptVersion(): string | null { return this.promptVersion }
  public getConfidenceScore(): number | null { return this.confidenceScore }
  public getCreatedAt(): Date { return this.createdAt }
  public getProcessedAt(): Date | null { return this.processedAt }
}
