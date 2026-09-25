import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  PORT: z.string().default('3001').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRICE_PERSONAL: z.string().optional().default(''),
  STRIPE_PRICE_PRO: z.string().optional().default(''),
  VITE_APP_URL: z.string().optional().default('http://localhost:5173'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_KEY: z.string().optional().default(''),
})

const rawEnv = {
  ...process.env,
  CLIENT_URL: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
}

const parsedEnv = envSchema.safeParse(rawEnv)

if (!parsedEnv.success) {
  console.error('❌ Configuración de variables de entorno inválida:', parsedEnv.error.format())
  throw new Error('Variables de entorno incorrectas')
}

export const env = {
  ...parsedEnv.data,
  SUPABASE_SERVICE_ROLE_KEY: parsedEnv.data.SUPABASE_SERVICE_KEY,
  FRONTEND_URL: parsedEnv.data.CLIENT_URL,
}
