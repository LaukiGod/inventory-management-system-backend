import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { AppError } from '../middleware/errorHandler'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'STAFF']).optional(),
})

const resetPasswordSchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
})

// GET /users
export async function getUsers(_req: Request, res: Response) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new AppError('Failed to fetch users')

  res.json(data)
}

// POST /users
export async function createUser(req: Request, res: Response) {
  const body = createUserSchema.parse(req.body)

  // Create auth user first
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true, // skip email verification
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      throw new AppError('A user with this email already exists', 409)
    }
    throw new AppError('Failed to create user account')
  }

  // Insert into our users table
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: body.email,
      name: body.name,
      role: body.role,
    })
    .select('id, name, email, role, is_active, created_at')
    .single()

  if (error) {
    // Rollback auth user if our insert failed
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw new AppError('Failed to create user profile')
  }

  res.status(201).json(data)
}

// PATCH /users/:id
export async function updateUser(req: Request, res: Response) {
  const { id } = req.params
  const body = updateUserSchema.parse(req.body)

  if (Object.keys(body).length === 0) {
    throw new AppError('No fields provided to update')
  }

  const { data, error } = await supabase
    .from('users')
    .update(body)
    .eq('id', id)
    .select('id, name, email, role, is_active, created_at')
    .single()

  if (error || !data) throw new AppError('User not found', 404)

  res.json(data)
}

// PATCH /users/:id/deactivate  — toggles is_active
export async function toggleDeactivate(req: Request, res: Response) {
  const { id } = req.params
  const schema = z.object({ is_active: z.boolean() })
  const { is_active } = schema.parse(req.body)

  // Prevent admin from deactivating themselves
  if (id === req.user!.id) {
    throw new AppError('You cannot deactivate your own account')
  }

  const { data, error } = await supabase
    .from('users')
    .update({ is_active })
    .eq('id', id)
    .select('id, name, email, role, is_active')
    .single()

  if (error || !data) throw new AppError('User not found', 404)

  res.json(data)
}

// PATCH /users/:id/reset-password
export async function resetPassword(req: Request, res: Response) {
  const { id } = req.params
  const { new_password } = resetPasswordSchema.parse(req.body)

  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: new_password,
  })

  if (error) throw new AppError('Failed to reset password')

  res.json({ message: 'Password reset successfully' })
}

// GET /users/me — current user profile
export async function getMe(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_active, created_at')
    .eq('id', req.user!.id)
    .single()

  if (error || !data) throw new AppError('User not found', 404)

  res.json(data)
}

// PATCH /users/me/password — change own password
export async function changeOwnPassword(req: Request, res: Response) {
  const schema = z.object({
    new_password: z.string().min(6, 'Password must be at least 6 characters'),
  })
  const { new_password } = schema.parse(req.body)

  const { error } = await supabase.auth.admin.updateUserById(req.user!.id, {
    password: new_password,
  })

  if (error) throw new AppError('Failed to change password')

  res.json({ message: 'Password changed successfully' })
}
