import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelegramMessengerService } from '../../src/modules/messaging/infrastructure/telegram/telegram-messenger.service.js'

describe('TelegramMessengerService (Adapter de Envío a Telegram)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rechaza si el proveedor no es telegram', async () => {
    const service = new TelegramMessengerService('token123')
    const result = await service.sendMessage('whatsapp', '12345', 'Hola')

    expect(result.success).toBe(false)
    expect(result.error).toContain('no soporta el proveedor "whatsapp"')
  })

  it('falla limpiamente si TELEGRAM_BOT_TOKEN está vacío', async () => {
    const service = new TelegramMessengerService('')
    const result = await service.sendMessage('telegram', '12345', 'Hola')

    expect(result.success).toBe(false)
    expect(result.error).toContain('TELEGRAM_BOT_TOKEN no configurado')
  })

  it('envía mensaje exitosamente y retorna el message_id de Telegram', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: { message_id: 889900 },
      }),
    } as any)

    const service = new TelegramMessengerService('test_token_valid')
    const result = await service.sendMessage('telegram', '987654', 'Gasto registrado')

    expect(result.success).toBe(true)
    expect(result.externalMessageId).toBe('889900')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest_token_valid/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '987654',
          text: 'Gasto registrado',
          parse_mode: 'HTML',
        }),
      })
    )
  })

  it('maneja error de respuesta de la API de Telegram (ej. bot bloqueado por usuario)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        ok: false,
        description: 'Forbidden: bot was blocked by the user',
      }),
    } as any)

    const service = new TelegramMessengerService('test_token_valid')
    const result = await service.sendMessage('telegram', '987654', 'Hola')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Forbidden: bot was blocked by the user')
  })
})
