import { describe, it, expect, vi } from 'vitest'
import { GeminiExpenseExtractor } from '../../src/modules/ledger/infrastructure/ai/gemini-expense-extractor.js'
import type { GeminiService, GeminiResponseResult } from '../../src/services/gemini.service.js'

describe('GeminiExpenseExtractor (Infrastructure AI Adapter)', () => {
  const createMockService = (responseText: string | null, model = 'gemini-flash-latest'): GeminiService => {
    return {
      generateContent: vi.fn().mockResolvedValue({
        candidates: responseText
          ? [
              {
                content: {
                  parts: [{ text: responseText }],
                },
              },
            ]
          : [],
        usedModel: model,
        latencyMs: 120,
      } as GeminiResponseResult),
    } as unknown as GeminiService
  }

  it('extrae múltiples partidas de gastos correctamente con categorías y montos limpios', async () => {
    const mockGeminiJson = JSON.stringify({
      items: [
        {
          amount: '1200.00',
          description: 'Gasolina',
          category: 'transport',
          kind: 'expense',
        },
        {
          amount: '350.50',
          description: 'Cena en pica pollo',
          category: 'food',
          kind: 'expense',
        },
      ],
      confidenceScore: 0.96,
      isAmbiguous: false,
    })

    const mockService = createMockService(mockGeminiJson)
    const extractor = new GeminiExpenseExtractor(mockService)

    const result = await extractor.extractFromText('1200 de gasolina y 350.50 de cena en pica pollo')

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({
      amount: '1200.00',
      description: 'Gasolina',
      category: 'transport',
      kind: 'expense',
    })
    expect(result.items[1]).toEqual({
      amount: '350.50',
      description: 'Cena en pica pollo',
      category: 'food',
      kind: 'expense',
    })
    expect(result.confidenceScore).toBe(0.96)
    expect(result.isAmbiguous).toBe(false)
    expect(result.model).toBe('gemini-flash-latest')
    expect(result.promptVersion).toBe('v1.1.0')
  })

  it('extrae ingresos correctamente (ej: cobro de quincena)', async () => {
    const mockGeminiJson = JSON.stringify({
      items: [
        {
          amount: '45000',
          description: 'Cobro de quincena',
          category: 'income',
          kind: 'income',
        },
      ],
      confidenceScore: 0.99,
      isAmbiguous: false,
    })

    const mockService = createMockService(mockGeminiJson)
    const extractor = new GeminiExpenseExtractor(mockService)

    const result = await extractor.extractFromText('Cobré la quincena 45000')

    expect(result.items).toHaveLength(1)
    expect(result.items[0].kind).toBe('income')
    expect(result.items[0].amount).toBe('45000')
    expect(result.isAmbiguous).toBe(false)
  })

  it('detecta ambigüedad y retorna clarificationQuestion cuando no hay montos', async () => {
    const mockGeminiJson = JSON.stringify({
      items: [],
      confidenceScore: 0.3,
      isAmbiguous: true,
      clarificationQuestion: '¿Cuánto gastaste en el supermercado?',
    })

    const mockService = createMockService(mockGeminiJson)
    const extractor = new GeminiExpenseExtractor(mockService)

    const result = await extractor.extractFromText('Fui al super hoy')

    expect(result.items).toHaveLength(0)
    expect(result.isAmbiguous).toBe(true)
    expect(result.clarificationQuestion).toBe('¿Cuánto gastaste en el supermercado?')
  })

  it('limpia bloques de markdown ```json ``` devueltos por Gemini', async () => {
    const wrappedJson = '```json\n{"items":[{"amount":"800","description":"Farmacia","category":"health","kind":"expense"}],"confidenceScore":0.9,"isAmbiguous":false}\n```'

    const mockService = createMockService(wrappedJson)
    const extractor = new GeminiExpenseExtractor(mockService)

    const result = await extractor.extractFromText('800 de farmacia')

    expect(result.items).toHaveLength(1)
    expect(result.items[0].description).toBe('Farmacia')
    expect(result.items[0].amount).toBe('800')
  })

  it('lanza error descriptivo cuando Gemini no devuelve candidatos', async () => {
    const mockService = createMockService(null)
    const extractor = new GeminiExpenseExtractor(mockService)

    await expect(extractor.extractFromText('100 pesos de pan')).rejects.toThrow(
      'Gemini no devolvió texto en la respuesta de extracción'
    )
  })

  it('falla con validación si el JSON devuelto no cumple el esquema Zod', async () => {
    const invalidJson = JSON.stringify({
      items: 'not-an-array-invalid',
    })

    const mockService = createMockService(invalidJson)
    const extractor = new GeminiExpenseExtractor(mockService)

    await expect(extractor.extractFromText('100 de pan')).rejects.toThrow()
  })
})
