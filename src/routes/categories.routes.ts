import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller'

const router = Router()

router.use(authenticate)

// GET is open to all authenticated users (staff needs categories for filtering)
router.get('/', getCategories)

// Write operations are admin only
router.post('/', requireAdmin, createCategory)
router.patch('/:id', requireAdmin, updateCategory)
router.delete('/:id', requireAdmin, deleteCategory)

export default router
