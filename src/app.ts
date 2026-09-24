import express, { Express } from 'express'
import cors from 'cors'
import { apiRouter } from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { env } from './config/env.js'

export const app: Express = express()

// CORS Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  env.CLIENT_URL,
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true)
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:')
      ) {
        return callback(null, true)
      }
      return callback(new Error(`CORS bloqueado para origen: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  })
)

// Raw body parser ONLY for Stripe Webhook signature verification
app.use(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' })
)

// JSON body parser for all other endpoints
app.use(express.json({ limit: '10mb' }))

// Request Logger (Development & QA)
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  }
  next()
})

// Mount API routes
app.use('/api', apiRouter)

// Fallback 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    status: 'fail',
    error: 'Ruta no encontrada en la API de AUREUS',
  })
})

// Centralized Global Error Handler
app.use(errorHandler)
