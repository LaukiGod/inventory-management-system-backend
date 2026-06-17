import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    res.status(400).json({ error: 'Validation failed', details: messages })
    return
  }

  // Known app errors thrown as plain Error with a status code
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // Unknown errors
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}

// Simple typed error class for throwing from controllers
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}
