import { Request, Response } from 'express'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { createObjectCsvWriter } from 'csv-writer'
import { supabase } from '../lib/supabase'
import { AppError } from '../middleware/errorHandler'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

const exportSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  item_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
})

async function fetchLogs(params: z.infer<typeof exportSchema>) {
  const startDate = toStartOfDay(new Date(params.from))
  const endDate = toEndOfDay(new Date(params.to))

  let query = supabase
    .from('stock_logs')
    .select(`
      id, type, quantity, note, created_at,
      stock_item:stock_item_id ( id, name ),
      user:performed_by ( id, name )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (params.item_id) query = query.eq('stock_item_id', params.item_id)
  if (params.staff_id) query = query.eq('performed_by', params.staff_id)

  const { data, error } = await query
  if (error) throw new AppError('Failed to fetch records for export')

  return (data ?? []).map((row: any) => ({
    date: new Date(row.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    item: row.stock_item?.name ?? '—',
    type: row.type,
    quantity: row.quantity,
    note: row.note ?? '',
    staff: row.user?.name ?? '—',
  }))
}

// GET /export/excel
export async function exportExcel(req: Request, res: Response) {
  const params = exportSchema.parse(req.query)
  const rows = await fetchLogs(params)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Inventory System'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Stock Logs')

  sheet.columns = [
    { header: 'Date & Time', key: 'date', width: 22 },
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Note', key: 'note', width: 36 },
    { header: 'Staff', key: 'staff', width: 20 },
  ]

  // Header row styling
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A6B3A' },
  }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 24

  // Data rows with alternating colour + type colour coding
  rows.forEach((row, index) => {
    const dataRow = sheet.addRow(row)
    dataRow.height = 20

    // Alternate row background
    const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF5FAF7'
    dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }

    // Colour the type cell
    const typeCell = dataRow.getCell('type')
    typeCell.font = {
      bold: true,
      color: { argb: row.type === 'RECEIVED' ? 'FF166534' : 'FF991B1B' },
    }
  })

  // Border on all cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  })

  const filename = `stock-logs-${params.from}-to-${params.to}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  await workbook.xlsx.write(res)
  res.end()
}

// GET /export/csv
export async function exportCsv(req: Request, res: Response) {
  const params = exportSchema.parse(req.query)
  const rows = await fetchLogs(params)

  const tmpFile = path.join(os.tmpdir(), `stock-logs-${Date.now()}.csv`)

  const writer = createObjectCsvWriter({
    path: tmpFile,
    header: [
      { id: 'date', title: 'Date & Time' },
      { id: 'item', title: 'Item' },
      { id: 'type', title: 'Type' },
      { id: 'quantity', title: 'Quantity' },
      { id: 'note', title: 'Note' },
      { id: 'staff', title: 'Staff' },
    ],
  })

  await writer.writeRecords(rows)

  const filename = `stock-logs-${params.from}-to-${params.to}.csv`
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  const stream = fs.createReadStream(tmpFile)
  stream.pipe(res)
  stream.on('end', () => fs.unlink(tmpFile, () => {}))
  stream.on('error', () => {
    fs.unlink(tmpFile, () => {})
    throw new AppError('Failed to generate CSV')
  })
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
