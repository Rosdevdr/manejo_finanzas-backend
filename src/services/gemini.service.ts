import { env } from '../config/env.js'
import { GeminiRequestInput } from '../validators/schemas.js'

export interface GeminiResponseResult {
  candidates?: any[]
  usageMetadata?: any
  usedModel: string
  latencyMs: number
}

export class GeminiService {
  private static readonly CANDIDATE_MODELS = [
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemma-4-31b-it',
    'gemini-2.5-flash',
    'gemini-pro-latest',
  ]

  public async generateContent(input: GeminiRequestInput): Promise<GeminiResponseResult> {
    const key = input.apiKey || env.GEMINI_API_KEY
    if (!key) {
      throw new Error('Falta la clave API de Google Gemini (no provista en request ni en variable GEMINI_API_KEY)')
    }

    const requestedModel = input.model || 'gemini-flash-latest'
    const modelsToTry = Array.from(new Set([requestedModel, ...GeminiService.CANDIDATE_MODELS]))

    let lastError: string = 'No se pudo conectar con los modelos de Gemini'
    const startTime = Date.now()

    for (const model of modelsToTry) {
      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`

      try {
        const response = await fetch(googleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input.payload),
        })

        if (response.ok) {
          const data: any = await response.json()
          const latencyMs = Date.now() - startTime
          return {
            ...data,
            usedModel: model,
            latencyMs,
          }
        }

        const errData: any = await response.json().catch(() => ({}))
        lastError = errData?.error?.message || `HTTP ${response.status} en modelo ${model}`
      } catch (err: any) {
        lastError = err.message || `Fallo de conexión hacia ${model}`
      }
    }

    throw new Error(lastError)
  }
}

export const geminiService = new GeminiService()
