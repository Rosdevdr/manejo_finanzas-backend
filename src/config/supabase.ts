import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'

let supabaseClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY

  if (supabaseUrl && serviceKey) {
    try {
      supabaseClient = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    } catch (err) {
      console.warn('⚠️ No se pudo inicializar Supabase Admin:', err)
    }
  }

  return supabaseClient
}

export const supabase = getSupabaseAdmin()
