import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import { getSummary, getLowStock, getChartData } from '../controllers/dashboard.controller'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/summary', getSummary)
router.get('/low-stock', getLowStock)
router.get('/chart', getChartData)

export default router
