import { Request, Response } from 'express'
import { uploadImage } from '../lib/cloudinary'
import { AppError } from '../middleware/errorHandler'

// POST /upload/image
// Accepts multipart/form-data with field name "image"
export async function uploadItemImage(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError('No image file provided', 400)
  }

  const url = await uploadImage(req.file.buffer, req.file.mimetype)

  res.status(201).json({ url })
}
