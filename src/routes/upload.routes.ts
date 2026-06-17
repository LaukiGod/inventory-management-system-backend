import { Router } from 'express'
import { authenticate, requireAny } from '../middleware/auth'
import { upload } from '../middleware/upload'
import { uploadItemImage } from '../controllers/upload.controller'

const router = Router()

router.use(authenticate)

// Standalone image upload endpoint — returns a Cloudinary URL
// Used when frontend wants to upload image separately before saving an item
router.post('/image', requireAny, upload.single('image'), uploadItemImage)

export default router
