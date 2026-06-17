import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { AppError } from '../middleware/errorHandler'

const categorySchema = z.object({
  name: z.string().min(1).max(50).trim(),
})

// GET /categories
export async function getCategories(_req: Request, res: Response) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, created_at')
    .order('name', { ascending: true })

  if (error) throw new AppError('Failed to fetch categories')

  res.json(data)
}

// POST /categories
export async function createCategory(req: Request, res: Response) {
  const { name } = categorySchema.parse(req.body)

  const { data, error } = await supabase
    .from('categories')
    .insert({ name })
    .select('id, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('A category with this name already exists', 409)
    throw new AppError('Failed to create category')
  }

  res.status(201).json(data)
}

// PATCH /categories/:id
export async function updateCategory(req: Request, res: Response) {
  const { id } = req.params
  const { name } = categorySchema.parse(req.body)

  const { data, error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select('id, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('A category with this name already exists', 409)
    if (!data) throw new AppError('Category not found', 404)
    throw new AppError('Failed to update category')
  }

  res.json(data)
}

// DELETE /categories/:id
export async function deleteCategory(req: Request, res: Response) {
  const { id } = req.params

  // Check if any active items use this category
  const { count } = await supabase
    .from('stock_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('is_active', true)

  if (count && count > 0) {
    throw new AppError(
      `Cannot delete — ${count} active stock item(s) are using this category. Reassign them first.`,
      409
    )
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) throw new AppError('Failed to delete category')

  res.json({ message: 'Category deleted' })
}
