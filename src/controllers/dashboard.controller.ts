import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { AppError } from '../middleware/errorHandler'

// GET /dashboard/summary
export async function getSummary(_req: Request, res: Response) {
  const today = new Date()
  const startOfToday = toStartOfDay(today)
  const endOfToday = toEndOfDay(today)

  const [itemsResult, lowStockResult, todayLogsResult] = await Promise.all([
    // Total active items
    supabase
      .from('stock_items')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Items at or below threshold
    supabase
      .from('stock_items')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .filter('current_qty', 'lte', 'low_stock_threshold'),

    // Today's log count
    supabase
      .from('stock_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfToday)
      .lte('created_at', endOfToday),
  ])

  if (itemsResult.error || todayLogsResult.error) {
    throw new AppError('Failed to load dashboard summary')
  }

  res.json({
    total_items: itemsResult.count ?? 0,
    low_stock_count: lowStockResult.count ?? 0,
    today_updates: todayLogsResult.count ?? 0,
  })
}

// GET /dashboard/low-stock
export async function getLowStock(_req: Request, res: Response) {
  // Use a raw SQL filter — supabase-js can't compare two columns directly
  const { data, error } = await supabase
    .from('stock_items')
    .select(`
      id, name, image_url, current_qty, low_stock_threshold,
      category:category_id ( id, name )
    `)
    .eq('is_active', true)
    .filter('current_qty', 'lte', 'low_stock_threshold')
    .order('current_qty', { ascending: true })

  if (error) throw new AppError('Failed to fetch low stock items')

  // supabase-js column comparison workaround: filter in JS
  const lowStock = (data ?? []).filter(
    (item: any) => item.current_qty <= item.low_stock_threshold
  )

  res.json(lowStock)
}

// GET /dashboard/chart?days=7
export async function getChartData(req: Request, res: Response) {
  const schema = z.object({
    days: z.coerce.number().int().min(1).max(90).default(7),
  })
  const { days } = schema.parse(req.query)

  const results: { date: string; received: number; consumed: number }[] = []

  // Build date range — last N days including today
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    const startOfDay = toStartOfDay(date)
    const endOfDay = toEndOfDay(date)
    const label = date.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('stock_logs')
      .select('type')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)

    if (error) throw new AppError('Failed to fetch chart data')

    const received = (data ?? []).filter((r: any) => r.type === 'RECEIVED').length
    const consumed = (data ?? []).filter((r: any) => r.type === 'CONSUMED').length

    results.push({ date: label, received, consumed })
  }

  res.json(results)
}

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
