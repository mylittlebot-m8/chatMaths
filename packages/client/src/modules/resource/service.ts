import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { PostImageModel } from './model'
import type { z } from 'zod'

type UploadImageBody = z.infer<typeof PostImageModel.body>

export const uploadImage = async (body: UploadImageBody) => {
  const client = new S3Client({
    // 阿里云 OSS 使用 virtual hosted style
    
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-beijing.aliyuncs.com',
    credentials: {
      accessKeyId: process.env.OSS_ACCESS_KEY!,
      secretAccessKey: process.env.OSS_SECRET_KEY!,
    },
    forcePathStyle: false,
  })

  const file = body.file

  if (!file) {
    throw new Error('No file uploaded')
  }

  const id = crypto.randomUUID()
  const fileExtension = file.name.split('.').pop()
  const key = `${id}.${fileExtension}`

  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const command = new PutObjectCommand({
    Bucket: process.env.OSS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type || 'image/jpeg',
  })

  await client.send(command)

  const publicUrl = `https://${process.env.OSS_BUCKET || 'aiguodu'}.${(process.env.OSS_ENDPOINT || 'https://oss-cn-beijing.aliyuncs.com').replace('https://', '')}/${key}`

  return {
    success: true,
    url: publicUrl,
    key,
  }
}