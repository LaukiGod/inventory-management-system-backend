import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

const router = Router()

const SECRET = process.env.MIGRATE_SECRET || 'migrate-now'

router.get('/migrate', async (req: Request, res: Response) => {
  const { secret } = req.query
  if (secret !== SECRET) {
    res.status(403).json({ error: 'Invalid secret' })
    return
  }

  let pool: Pool | null = null

  try {
    const supabaseUrl = process.env.SUPABASE_URL!
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    pool = new Pool({
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })

    const sqlPath = path.resolve(__dirname, '../sql/migration.sql')
    let sql = fs.readFileSync(sqlPath, 'utf8')

    sql = sql.replace(/-- ============================================================\n-- SEED:.*[\s\S]*$/, '')

    const client = await pool.connect()
    await client.query(sql)

    await client.query(`
      INSERT INTO users (id, email, name, role, is_active)
      VALUES
        ('75af7304-8b90-4487-bffa-4c9b20e2a5cf', 'admin@admin.com', 'Admin', 'ADMIN', true),
        ('e86e017f-a81e-4be4-aeb7-95d2c6d17ee8', 'staff@staff.com', 'Staff', 'STAFF', true)
      ON CONFLICT (id) DO NOTHING
    `)

    const { rows } = await client.query('SELECT id, email, name, role FROM users')
    client.release()

    res.json({ success: true, message: 'Migration and seeding completed', users: rows })
  } catch (err: any) {
    res.status(500).json({ error: 'Migration failed', detail: err.message })
  } finally {
    if (pool) await pool.end()
  }
})

export default router
