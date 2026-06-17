import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { AppError } from '../middleware/errorHandler'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// POST /auth/login
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session || !data.user) {
    throw new AppError('Incorrect email or password', 401)
  }

  // Check our users table for role and active status
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, name, email, role, is_active')
    .eq('id', data.user.id)
    .single()

  if (userErr || !userRow) {
    throw new AppError('Account not found. Contact your admin.', 401)
  }

  if (!userRow.is_active) {
    throw new AppError('Your account has been deactivated. Contact your admin.', 403)
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
    },
  })
}

// POST /auth/logout
export async function logout(req: Request, res: Response) {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    await supabase.auth.admin.signOut(token)
  }
  res.json({ message: 'Logged out successfully' })
}

// POST /auth/refresh
export async function refresh(req: Request, res: Response) {
  const schema = z.object({ refresh_token: z.string().min(1) })
  const { refresh_token } = schema.parse(req.body)

  const { data, error } = await supabase.auth.refreshSession({ refresh_token })

  if (error || !data.session) {
    throw new AppError('Session expired. Please log in again.', 401)
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
