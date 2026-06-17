import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export async function uploadImage(fileBuffer: Buffer, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'inventory',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'))
        } else {
          resolve(result.secure_url)
        }
      }
    )
    uploadStream.end(fileBuffer)
  })
}

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extract public_id from the Cloudinary URL
    const parts = imageUrl.split('/')
    const fileWithExt = parts[parts.length - 1]
    const folder = parts[parts.length - 2]
    const publicId = `${folder}/${fileWithExt.split('.')[0]}`
    await cloudinary.uploader.destroy(publicId)
  } catch {
    // Non-critical — log but don't fail the request
    console.warn('Failed to delete image from Cloudinary:', imageUrl)
  }
}
