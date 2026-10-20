// ==============================================================================
// 🏛️ AUREUS · ROUTES: WEBHOOKS (TELEGRAM / WHATSAPP)
// ==============================================================================

import { Router } from 'express'
import { TelegramWebhookController } from '../modules/messaging/interfaces/http/telegram-webhook.controller.js'

export const webhooksRouter = Router()
const telegramWebhookController = new TelegramWebhookController()

// Endpoint para el webhook de Telegram Bot API
webhooksRouter.post('/telegram', telegramWebhookController.handle)
