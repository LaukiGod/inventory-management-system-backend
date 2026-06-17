import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import {
  getUsers,
  createUser,
  updateUser,
  toggleDeactivate,
  resetPassword,
  getMe,
  changeOwnPassword,
} from '../controllers/users.controller'

const router = Router()

// All user routes require auth
router.use(authenticate)

// Self-service (any authenticated user)
router.get('/me', getMe)
router.patch('/me/password', changeOwnPassword)

// Admin only
router.get('/', requireAdmin, getUsers)
router.post('/', requireAdmin, createUser)
router.patch('/:id', requireAdmin, updateUser)
router.patch('/:id/deactivate', requireAdmin, toggleDeactivate)
router.patch('/:id/reset-password', requireAdmin, resetPassword)

export default router
