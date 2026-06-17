import { Router } from 'express'
import { authenticate, requireAdmin, requireAny } from '../middleware/auth'
import { upload } from '../middleware/upload'
import {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
} from '../controllers/items.controller'
import { logStockUpdate, getLogs } from '../controllers/logs.controller'

const router = Router()

router.use(authenticate)

// Stock items — read + create + edit for all, delete admin only
router.get('/', requireAny, getItems)
router.get('/:id', requireAny, getItem)
router.post('/', requireAny, upload.single('image'), createItem)
router.patch('/:id', requireAny, upload.single('image'), updateItem)
router.delete('/:id', requireAdmin, deleteItem)

// Stock log for a specific item
router.post('/:id/log', requireAny, logStockUpdate)

export default router
