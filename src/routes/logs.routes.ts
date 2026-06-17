import { Router } from 'express'
import { authenticate, requireAny } from '../middleware/auth'
import { getLogs } from '../controllers/logs.controller'

const router = Router()

router.use(authenticate)

// GET /logs — staff see today only (enforced in controller), admin see any range
router.get('/', requireAny, getLogs)

export default router
