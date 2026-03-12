import './load-env'
import { Elysia, t } from 'elysia'
import { chat } from './modules/chat'
import { resource } from './modules/resource'
import { external } from './modules/external'
import { corsMiddleware } from './middlewares/cors'
import { globalErrorHandler } from './middlewares/error-handler'
import { readFileSync } from 'fs'
import { join } from 'path'

export const app = new Elysia()
  .use(corsMiddleware)
  .use(globalErrorHandler)
  .use(chat)
  .use(resource)
  .use(external)
  .get('/videos/:filename', ({ params }) => {
    const filePath = join('/tmp/avatar-videos', params.filename)
    try {
      const fileContent = readFileSync(filePath)
      return new Response(fileContent, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `inline; filename="${params.filename}"`,
        }
      })
    } catch (error) {
      return new Response('File not found', { status: 404 })
    }
  })
  .listen(8002)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
