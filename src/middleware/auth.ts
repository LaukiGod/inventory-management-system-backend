import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { UserRole } from '../types'

// Validates the Bearer token from Supabase Auth and attaches user to req
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  const token = authHeader.split(' ')[1]

  // Verify JWT with Supabase
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  // Fetch role + active status from our users table
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, email, role, is_active')
    .eq('id', data.user.id)
    .single()

  if (userErr || !userRow) {
    res.status(401).json({ error: 'User not found' })
    return
  }

  if (!userRow.is_active) {
    res.status(403).json({ error: 'Your account has been deactivated. Contact an admin.' })
    return
  }

  req.user = {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role as UserRole,
  }

  next()
}

// Role guard factory — use after authenticate
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action' })
      return
    }
    next()
  }
}

export const requireAdmin = requireRole('ADMIN')
export const requireAny = requireRole('ADMIN', 'STAFF')
