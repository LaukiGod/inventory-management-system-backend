import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'

import authRoutes from './routes/auth.routes'
import userRoutes from './routes/users.routes'
import categoryRoutes from './routes/categories.routes'
import itemRoutes from './routes/items.routes'
import logRoutes from './routes/logs.routes'
import dashboardRoutes from './routes/dashboard.routes'
import exportRoutes from './routes/export.routes'
import uploadRoutes from './routes/upload.routes'

import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT ?? 3000
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────
app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/categories', categoryRoutes)
app.use('/items', itemRoutes)
app.use('/logs', logRoutes)
app.use('/dashboard', dashboardRoutes)
app.use('/export', exportRoutes)
app.use('/upload', uploadRoutes)

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ── Global error handler (must be last) ──────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Inventory backend running on ${FRONTEND_URL}:${PORT}`)
})

export default app
