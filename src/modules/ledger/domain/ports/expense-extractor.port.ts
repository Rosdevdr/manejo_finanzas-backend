// ==============================================================================
// 🏛️ AUREUS · DOMAIN PORT: EXPENSE EXTRACTOR (CONTRATO DE EXTRACCIÓN CON IA)
// ==============================================================================

export interface ExtractedItem {
  amount: string
  description: string
  category: string
  kind: 'expense' | 'income'
}

export interface ExtractionResult {
  items: ExtractedItem[]
  confidenceScore: number
  isAmbiguous: boolean
  clarificationQuestion?: string
  rawResponse: Record<string, unknown>
  model: string
  promptVersion: string
}

export interface IExpenseExtractor {
  /**
   * Extrae partidas financieras estructuradas a partir de texto en lenguaje natural.
   */
  extractFromText(
    text: string,
    context?: { householdCurrency?: string; referenceDate?: Date }
  ): Promise<ExtractionResult>
}
