import { Request, Response, NextFunction } from 'express'
import { geminiService } from '../services/gemini.service.js'

export async function handleGeminiGenerate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await geminiService.generateContent(req.body)
    return res.status(200).json(result)
  } catch (error: any) {
    next(error)
  }
}
