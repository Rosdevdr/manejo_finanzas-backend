// ==============================================================================
// 🏛️ AUREUS · DOMAIN PORT: IDENTITY REPOSITORY (RESOLUCIÓN DE USUARIO & HOGAR)
// ==============================================================================

import type { ChannelProvider } from '../entities/inbox-event.entity.js'

export interface UserIdentity {
  userId: string
  householdId: string
  fullName: string
  currency: string
}

export interface IIdentityRepository {
  /**
   * Busca la identidad de usuario y hogar vinculada al canal externo (Telegram/WhatsApp).
   */
  findUserByChannel(provider: ChannelProvider, externalUserId: string): Promise<UserIdentity | null>

  /**
   * Obtiene la identidad o auto-aprovisiona un hogar y usuario inicial para permitir
   * la experiencia "zero-friction" inmediata sin formularios previos.
   */
  findOrCreateUserForChannel(
    provider: ChannelProvider,
    externalUserId: string,
    fullName?: string
  ): Promise<UserIdentity>
}
