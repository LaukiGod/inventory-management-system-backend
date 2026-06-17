import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import { exportExcel, exportCsv } from '../controllers/export.controller'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/excel', exportExcel)
router.get('/csv', exportCsv)

export default router
