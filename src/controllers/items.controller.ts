import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { uploadImage, deleteImage } from '../lib/cloudinary'
import { AppError } from '../middleware/errorHandler'

const createItemSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  category_id: z.string().uuid().optional().nullable(),
  current_qty: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(10),
})

const updateItemSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  category_id: z.string().uuid().optional().nullable(),
  low_stock_threshold: z.coerce.number().int().min(0).optional(),
})

// GET /items
// Returns all active items with their category name joined
export async function getItems(req: Request, res: Response) {
  const { search, category_id } = req.query

  let query = supabase
    .from('stock_items')
    .select(`
      id, name, image_url, current_qty, low_stock_threshold, created_at,
      category:category_id ( id, name ),
      created_by_user:created_by ( id, name )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (search && typeof search === 'string') {
    query = query.ilike('name', `%${search}%`)
  }

  if (category_id && typeof category_id === 'string') {
    query = query.eq('category_id', category_id)
  }

  const { data, error } = await query

  if (error) throw new AppError('Failed to fetch stock items')

  res.json(data)
}

// GET /items/:id
export async function getItem(req: Request, res: Response) {
  const { id } = req.params

  const { data, error } = await supabase
    .from('stock_items')
    .select(`
      id, name, image_url, current_qty, low_stock_threshold, created_at,
      category:category_id ( id, name ),
      created_by_user:created_by ( id, name )
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !data) throw new AppError('Stock item not found', 404)

  res.json(data)
}

// POST /items
// Accepts multipart/form-data if image included, otherwise JSON
export async function createItem(req: Request, res: Response) {
  const body = createItemSchema.parse(req.body)

  let image_url: string | null = null

  // If an image was uploaded alongside the form
  if (req.file) {
    image_url = await uploadImage(req.file.buffer, req.file.mimetype)
  }

  const { data, error } = await supabase
    .from('stock_items')
    .insert({
      name: body.name,
      category_id: body.category_id ?? null,
      image_url,
      current_qty: body.current_qty,
      low_stock_threshold: body.low_stock_threshold,
      created_by: req.user!.id,
    })
    .select(`
      id, name, image_url, current_qty, low_stock_threshold, created_at,
      category:category_id ( id, name )
    `)
    .single()

  if (error) throw new AppError('Failed to create stock item')

  res.status(201).json(data)
}

// PATCH /items/:id
export async function updateItem(req: Request, res: Response) {
  const { id } = req.params
  const body = updateItemSchema.parse(req.body)

  // Check item exists
  const { data: existing, error: fetchErr } = await supabase
    .from('stock_items')
    .select('id, image_url')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (fetchErr || !existing) throw new AppError('Stock item not found', 404)

  const updates: Record<string, unknown> = { ...body }

  // If a new image was uploaded, replace old one
  if (req.file) {
    const newImageUrl = await uploadImage(req.file.buffer, req.file.mimetype)
    updates.image_url = newImageUrl

    if (existing.image_url) {
      await deleteImage(existing.image_url)
    }
  }

  const { data, error } = await supabase
    .from('stock_items')
    .update(updates)
    .eq('id', id)
    .select(`
      id, name, image_url, current_qty, low_stock_threshold, created_at,
      category:category_id ( id, name )
    `)
    .single()

  if (error || !data) throw new AppError('Failed to update stock item')

  res.json(data)
}

// DELETE /items/:id — soft delete, admin only
export async function deleteItem(req: Request, res: Response) {
  const { id } = req.params

  const { data, error } = await supabase
    .from('stock_items')
    .update({ is_active: false })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !data) throw new AppError('Stock item not found', 404)

  res.json({ message: 'Stock item removed' })
}
