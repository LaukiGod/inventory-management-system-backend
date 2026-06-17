import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { AppError } from '../middleware/errorHandler'

const logSchema = z.object({
  type: z.enum(['RECEIVED', 'CONSUMED']),
  quantity: z.number().int().positive('Quantity must be a positive number'),
  note: z.string().max(500).optional().nullable(),
})

// POST /items/:id/log
export async function logStockUpdate(req: Request, res: Response) {
  const { id: itemId } = req.params
  const body = logSchema.parse(req.body)
  const userId = req.user!.id

  if (body.type === 'CONSUMED') {
    // Call the atomic Postgres function — handles lock + check + deduct + log
    const { data, error } = await supabase.rpc('consume_stock', {
      p_item_id: itemId,
      p_quantity: body.quantity,
      p_note: body.note ?? null,
      p_user_id: userId,
    })

    if (error) {
      if (error.message.includes('INSUFFICIENT_STOCK')) {
        throw new AppError('Not enough stock to consume. Check current quantity.', 400)
      }
      if (error.message.includes('ITEM_NOT_FOUND')) {
        throw new AppError('Stock item not found', 404)
      }
      throw new AppError('Failed to log stock update')
    }

    res.json({ message: 'Stock consumed', new_qty: data })
    return
  }

  // RECEIVED — also uses atomic function
  const { data, error } = await supabase.rpc('receive_stock', {
    p_item_id: itemId,
    p_quantity: body.quantity,
    p_note: body.note ?? null,
    p_user_id: userId,
  })

  if (error) {
    if (error.message.includes('ITEM_NOT_FOUND')) {
      throw new AppError('Stock item not found', 404)
    }
    throw new AppError('Failed to log stock update')
  }

  res.json({ message: 'Stock received', new_qty: data })
}

// GET /logs?date=today  — staff + admin, today only for staff
// GET /logs?from=YYYY-MM-DD&to=YYYY-MM-DD  — admin only (enforced in router)
// GET /logs?item_id=uuid&staff_id=uuid  — optional filters
export async function getLogs(req: Request, res: Response) {
  const { date, from, to, item_id, staff_id } = req.query
  const isAdmin = req.user!.role === 'ADMIN'

  let startDate: string
  let endDate: string

  if (date === 'today' || (!isAdmin)) {
    // Staff always see only today
    const today = new Date()
    startDate = toStartOfDay(today)
    endDate = toEndOfDay(today)
  } else if (from && to) {
    startDate = toStartOfDay(new Date(from as string))
    endDate = toEndOfDay(new Date(to as string))
  } else {
    // Default: today
    const today = new Date()
    startDate = toStartOfDay(today)
    endDate = toEndOfDay(today)
  }

  let query = supabase
    .from('stock_logs')
    .select(`
      id, type, quantity, note, created_at,
      stock_item:stock_item_id ( id, name, image_url ),
      user:performed_by ( id, name )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (item_id && typeof item_id === 'string') {
    query = query.eq('stock_item_id', item_id)
  }

  if (staff_id && typeof staff_id === 'string') {
    query = query.eq('performed_by', staff_id)
  }

  const { data, error } = await query

  if (error) throw new AppError('Failed to fetch logs')

  res.json(data)
}

// Helpers
function toStartOfDay(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function toEndOfDay(date: Date): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}
