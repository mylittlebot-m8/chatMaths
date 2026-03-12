import { cors } from '@elysiajs/cors'

const allowedOrigins = [
  'https://chattutor.app',
  'http://117.50.196.232:8001',
  'http://localhost:8001',
  'https://api.conghua.cn',
]

if (process.env.CLINET_BASE_URL) {
  allowedOrigins.push(process.env.CLINET_BASE_URL)
}
if (process.env.CLIENT_BASE_URL) {
  allowedOrigins.push(process.env.CLIENT_BASE_URL)
}

export const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})
