import { Request, Response, NextFunction } from 'express'
import { getSupabaseAdmin } from '../config/supabase.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
    }
  }
}

/**
 * Middleware para validar autenticación JWT con Supabase.
 * Soporta headers Bearer y simulación de prueba (x-user-id / test tokens).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const testUserId = req.headers['x-user-id'] as string | undefined

  // 1. Soporte para testing y desarrollo local seguro
  if (testUserId && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')) {
    req.userId = testUserId
    req.userEmail = (req.headers['x-user-email'] as string) || 'test@aureus.internal'
    next()
    return
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'fail',
      error: 'Token de autenticación requerido (Bearer <token>)',
    })
    return
  }

  const token = authHeader.split(' ')[1]

  // En entorno de test, permitir tokens de prueba formateados como "test-token-*"
  if (process.env.NODE_ENV === 'test' && token.startsWith('test-token')) {
    req.userId = req.headers['x-user-id'] as string || '00000000-0000-0000-0000-000000000001'
    req.userEmail = 'test@aureus.internal'
    next()
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    // Si no hay Supabase configurado en el backend, en desarrollo permitimos header x-user-id o generamos demo
    if (process.env.NODE_ENV === 'development') {
      req.userId = '00000000-0000-0000-0000-000000000001'
      req.userEmail = 'dev@aureus.internal'
      next()
      return
    }

    res.status(503).json({
      status: 'error',
      error: 'Servicio de autenticación no disponible en el backend',
    })
    return
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({
        status: 'fail',
        error: 'Token inválido o sesión expirada',
      })
      return
    }

    req.userId = user.id
    req.userEmail = user.email
    next()
  } catch (err: any) {
    res.status(401).json({
      status: 'fail',
      error: 'Error de verificación de autenticación',
    })
  }
}
