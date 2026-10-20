// ==============================================================================
// 🏛️ AUREUS · INFRASTRUCTURE: GEMINI EXPENSE EXTRACTOR (IA ESTRUCTURADA CON ZOD)
// ==============================================================================

import { z } from 'zod'
import type { IExpenseExtractor, ExtractionResult } from '../../domain/ports/expense-extractor.port.js'
import { GeminiService, geminiService } from '../../../../services/gemini.service.js'

const PROMPT_VERSION = 'v1.1.0'

const extractionJsonSchema = z.object({
  items: z
    .array(
      z.object({
        amount: z.union([z.string(), z.number()]).transform(v => String(v).trim()),
        description: z.string().min(1),
        category: z.string().default('other'),
        kind: z.enum(['expense', 'income']).default('expense'),
      })
    )
    .default([]),
  confidenceScore: z.number().min(0).max(1).default(0.9),
  isAmbiguous: z.boolean().default(false),
  clarificationQuestion: z.string().optional(),
})

export class GeminiExpenseExtractor implements IExpenseExtractor {
  constructor(
    private readonly service: GeminiService = geminiService,
    private readonly defaultModel: string = 'gemini-flash-latest'
  ) {}

  public async extractFromText(
    text: string,
    context?: { householdCurrency?: string; referenceDate?: Date }
  ): Promise<ExtractionResult> {
    const currency = context?.householdCurrency || 'DOP'
    const todayStr = (context?.referenceDate || new Date()).toISOString().split('T')[0]

    const systemPrompt = `
Eres el motor de extracción financiera de AUREUS, un asistente para familias en República Dominicana.
Tu tarea es analizar el texto del usuario y extraer las transacciones financieras (gastos o ingresos).

Fecha de referencia: ${todayStr}
Moneda por defecto: ${currency}

Reglas estrictas:
1. Extrae cada partida por separado. Si el usuario dice "1200 de gasolina y 350 de cena", genera 2 items distintos.
2. Soporta modismos y términos dominicanos:
   - "gasolina", "gasoil" -> category: "transport", description: "Gasolina"
   - "colmado", "super", "plátanos", "cena", "almuerzo" -> category: "food"
   - "luz", "edesur", "edenorte", "internet", "claro", "altice" -> category: "utilities"
   - "nómina", "quincena", "sueldo", "me transfirieron" -> kind: "income"
3. El campo "amount" debe ser un string con el número limpio (ej: "1200.00", "350.50", "1502.45"). Si dijeron números en letras ("mil quinientos con cincuenta"), conviértelo a "1500.50".
4. Si el texto no menciona monto o es completamente ambiguo (ej: "fui al mall"), marca isAmbiguous: true y redacta una clarificationQuestion amigable y corta.
5. Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "items": [
    {
      "amount": "1200.00",
      "description": "Gasolina",
      "category": "transport",
      "kind": "expense"
    }
  ],
  "confidenceScore": 0.95,
  "isAmbiguous": false
}
`

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nMensaje a procesar:\n"${text}"` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1, // Baja temperatura para máxima consistencia determinista
      },
    }

    const response = await this.service.generateContent({
      model: this.defaultModel,
      payload,
    })

    const rawCandidate = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawCandidate) {
      throw new Error('Gemini no devolvió texto en la respuesta de extracción')
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(rawCandidate)
    } catch {
      // Intento de rescate si Gemini envolvió en bloques markdown
      const cleaned = rawCandidate.replace(/```json/g, '').replace(/```/g, '').trim()
      parsedJson = JSON.parse(cleaned)
    }

    const validated = extractionJsonSchema.parse(parsedJson)

    return {
      items: validated.items,
      confidenceScore: validated.confidenceScore,
      isAmbiguous: validated.isAmbiguous,
      clarificationQuestion: validated.clarificationQuestion,
      rawResponse: response as unknown as Record<string, unknown>,
      model: response.usedModel || this.defaultModel,
      promptVersion: PROMPT_VERSION,
    }
  }
}
