import { chat } from '@chat-tutor/db/schema'
import { db } from '@chat-tutor/db'
import { desc, eq } from 'drizzle-orm'
import { ClientAction, ClientMessage, AgentClientMessage, Context, createMessageResolver, Page, Status, UserAction } from '@chat-tutor/shared'
import { AgentProvider, createAgent, getTitle } from '@chat-tutor/agent'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { ModelMessage } from 'ai'
import { AgentConfigError, ChatIsRunningError } from './error'

export const getChats = async (limit: number, offset: number) => {
  try {
    const chats = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })
      .from(chat)
      .orderBy(desc(chat.createdAt))
      .limit(limit)
      .offset(offset)
    return chats
  } catch (error) {
    console.error(error)
    return []
  }

}

export const updateChatTitle = async (id: string, title: string) => {
  await db
    .update(chat)
    .set({
      title,
    })
    .where(eq(chat.id, id))
}

export const createChat = async (input: string) => {
  const [{ id }] = await db
    .insert(chat)
    .values({
      title: 'New Chat',
      status: ''
    })
    .returning({
      id: chat.id
    })
  getTitle({
    apiKey: process.env.MODEL_API_KEY!,
    baseURL: process.env.MODEL_BASE_URL!,
    model: process.env.TITLE_MODEL || process.env.AGENT_MODEL!,
    provider: (process.env.TITLE_MODEL_PROVIDER || process.env.AGENT_MODEL_PROVIDER) as AgentProvider,
  }, input).then(title => {
    updateChatTitle(id, title)
  })
  return id
}

export const getChatById = async (id: string) => {
  const [result] = await db
    .select({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      status: chat.status,
      pages: chat.pages,
      messages: chat.messages,
    })
    .from(chat)
    .where(eq(chat.id, id))
  return result
}

export const getChatContext = async (id: string) => {
  const [result] = await db
    .select({
      context: chat.context,
    })
    .from(chat)
    .where(eq(chat.id, id))
  return result.context as Context
}

export const getChatMessages = async (id: string) => {
  const [result] = await db
    .select({
      messages: chat.messages,
    })
    .from(chat)
    .where(eq(chat.id, id))
  return result.messages as ClientMessage[]
}

export const getChatPages = async (id: string) => {
  const [result] = await db
    .select({
      pages: chat.pages,
    })
    .from(chat)
    .where(eq(chat.id, id))
  return result.pages as Page[]
}

export const getChatRecord = async (id: string) => {
  const [result] = await db
    .select({
      id: chat.id,
      context: chat.context,
      messages: chat.messages,
      pages: chat.pages,
    })
    .from(chat)
    .where(eq(chat.id, id))
  return result as {
    id: string
    context: Context
    messages: ClientMessage[]
    pages: Page[]
  }
}

export const updateChatRecord = async (
  { id, context, messages, pages }: {
    id: string
    context: Context
    messages: ClientMessage[]
    pages: Page[]
  }) => {
  await db
    .update(chat)
    .set({
      context,
      messages,
      pages,
    })
    .where(eq(chat.id, id))
}

export const getChatStatus = async (id: string) => {
  const [result] = await db
    .select({
      status: chat.status,
    })
    .from(chat)
    .where(eq(chat.id, id))
  return result.status as Status
}

export const updateChatStatus = async (id: string, status: Status) => {
  await db
    .update(chat)
    .set({
      status,
    })
    .where(eq(chat.id, id))
}

export const createChatStream = () => {
  const agentContext: ModelMessage[] = []
  const messages: ClientMessage[] = []
  const pages: Page[] = []
  let apiKey = process.env.MODEL_API_KEY
  let baseURL = process.env.MODEL_BASE_URL
  let model = process.env.AGENT_MODEL
  let provider = process.env.AGENT_MODEL_PROVIDER as AgentProvider
  let controller: AbortController | null = null
  const update = async (id: string) => {
    const { context: c, messages: m, pages: p } = await getChatRecord(id)
    messages.length = 0
    messages.push(...m)
    pages.length = 0
    pages.push(...p)
    agentContext.length = 0
    agentContext.push(...c.agent)
  }
  const resolve = createMessageResolver({
    get: () => messages,
    push: (message) => {
      messages.push(message)
    },
    uuid: () => crypto.randomUUID(),
  })
  const agent = createAgent({
    messages: agentContext,
    pages,
  })
  return {
    update,
    async open(query: {
      apiKey?: string
      baseURL?: string
      model?: string
      provider?: AgentProvider
    }) {
      if (query.apiKey) apiKey = query.apiKey
      if (query.baseURL) baseURL = query.baseURL
      if (query.model) model = query.model
      if (query.provider) provider = query.provider
    },
    async act(id: string, input: UserAction, emit: (action: ClientAction) => void) {
      if (input.type === 'user-abort') {
        if (controller) {
          controller.abort()
        }
        return
      }

      await update(id)

      resolve(input)
      try {
        if (input.type === 'user-input') {
          const status = await getChatStatus(id)
          if (status === Status.RUNNING) {
            throw new ChatIsRunningError('Chat is already running')
          }

          controller = new AbortController()
          await updateChatStatus(id, Status.RUNNING)
          console.log(`Starting agent for chat ${id} with config:`, { model, provider, baseURL, hasApiKey: !!apiKey })
          if (!apiKey || !baseURL || !model || !provider) {
            console.error('Agent configuration missing:', { apiKey: !!apiKey, baseURL, model, provider })
            const errorAction = { type: 'error', error: 'Agent configuration is not set. Please check settings or .env file.' } as any
            resolve(errorAction)
            emit(errorAction)
            throw new AgentConfigError('Agent configuration is not set')
          }
          let segmentBuffer = ''
          let videoTaskQueue = Promise.resolve()
          const startTime = Date.now()
          let segmentCount = 0;
          let segmentThreshold = 100; // Smaller segments to avoid TTS limits

          const triggerVideoGen = (text: string) => {
            const currentSegment = ++segmentCount
            const trimmed = text.trim()
            if (trimmed.length < 5) return

            // Add to sequential queue
            videoTaskQueue = videoTaskQueue.then(async () => {
              const segStart = Date.now()
              console.log(`[VideoGen][Seg ${currentSegment}] Starting generation (Length: ${trimmed.length} chars)`)

              try {
                // Safety Delay: Give the TTS server some breathing room between requests
                if (currentSegment > 1) {
                  await new Promise(r => setTimeout(r, 2000))
                }

                const apiStart = Date.now()
                const requestBody = { text: trimmed }
                console.log(`[VideoGen][Seg ${currentSegment}] Sending request:`, JSON.stringify(requestBody))
                console.log(`[VideoGen][Seg ${currentSegment}] HTTP Proxy env:`, {
                  HTTP_PROXY: process.env.HTTP_PROXY,
                  HTTPS_PROXY: process.env.HTTPS_PROXY,
                  http_proxy: process.env.http_proxy,
                  https_proxy: process.env.https_proxy,
                })
                let res = await fetch('http://117.50.196.232:7862/generate_qwen', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                })

                // If models are warming up (503), wait and retry once
                if (res.status === 503) {
                  console.log(`[VideoGen][Seg ${currentSegment}] Server is warming up, waiting 10s...`)
                  await new Promise(r => setTimeout(r, 10000))
                  res = await fetch('http://117.50.196.232:7862/generate_qwen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: trimmed })
                  })
                }

                const apiEnd = Date.now()
                console.log(`[VideoGen][Seg ${currentSegment}] API Response received in ${apiEnd - apiStart}ms`)
                console.log(`[VideoGen][Seg ${currentSegment}] Response status: ${res.status} ${res.statusText}`)
                console.log(`[VideoGen][Seg ${currentSegment}] Response headers:`, Object.fromEntries(res.headers.entries()))

                // Performance breakdown from server
                const ttsTime = res.headers.get('X-TTS-Time')
                const videoTime = res.headers.get('X-Video-Time')
                const serverTotal = res.headers.get('X-Total-Server-Time')

                if (ttsTime || videoTime) {
                  console.log(`[VideoGen][Seg ${currentSegment}] Server Stats: TTS: ${ttsTime}ms, VideoGen: ${videoTime}ms, ServerTotal: ${serverTotal}ms`)
                }

                if (res.ok) {
                  const arrayBuffer = await res.arrayBuffer()
                  const ossStart = Date.now()

                  // Save video to local temporary directory
                  const fs = await import('fs/promises')
                  const path = await import('path')
                  const crypto = await import('crypto')

                  const videoDir = '/tmp/avatar-videos'
                  await fs.mkdir(videoDir, { recursive: true })
                  const key = `avatar_${crypto.randomUUID()}.mp4`
                  const localPath = path.join(videoDir, key)

                  await fs.writeFile(localPath, Buffer.from(arrayBuffer))

                  const ossEnd = Date.now()
                  // Construct video URL based on available environment variables
                  let baseURL = process.env.API_BASE_URL ||
                    process.env.VITE_API_BASE_URL ||
                    process.env.CLIENT_BASE_URL ||
                    process.env.CLINET_BASE_URL ||
                    'https://api.conghua.cn/api'


                  console.log(`[VideoGen][Seg ${currentSegment}] Detected baseURL source:`, baseURL)

                  // Clean up the URL:
                  // 1. Remove trailing slash
                  // 2. Keep the rest as provided to match the actual server setup
                  baseURL = baseURL.replace(/\/$/, '')
                  // baseURL = baseURL.replace(/\/api$/, '')

                  const videoUrl = `http://117.50.196.232:8002/videos/${key}`

                  console.log(`[VideoGen][Seg ${currentSegment}] Video saved to local in ${ossEnd - ossStart}ms. Total segment time: ${ossEnd - segStart}ms`)
                  console.log(`[VideoGen][Seg ${currentSegment}] Ready: ${videoUrl}`)


                  const videoAction = { type: 'avatar-video', options: { url: videoUrl } } as ClientAction
                  resolve(videoAction)
                  emit(videoAction)
                } else {
                  const errorText = await res.text()
                  console.error(`[VideoGen][Seg ${currentSegment}] Server Error (${res.status}):`, errorText)
                }
              } catch (err: any) {
                console.error(`[VideoGen][Seg ${currentSegment}] Network/Socket Error:`, err.message || err)
              }
            })
          }

          const { speakableText } = await agent({
            prompt: input.options.prompt,
            emit: (action) => {
              if (action.type === 'tts-text') {
                segmentBuffer += action.options.text

                // Adaptive Segmentation: Smaller first chunk, larger subsequent ones
                if (segmentBuffer.length > segmentThreshold) {
                  const lastChar = segmentBuffer.trim().slice(-1)
                  const punctuations = ['.', '!', '?', '。', '！', '？', '\n', '；', ';']
                  if (punctuations.includes(lastChar)) {
                    const textToGen = segmentBuffer
                    segmentBuffer = ''
                    triggerVideoGen(textToGen)
                    segmentThreshold = 150 // Smaller threshold to avoid TTS limits
                  }
                }
                return // Internal action, no need to resolve or emit
              }

              if (action.type === 'text') {
                // Regular text is now only for display, not for TTS
              } else if (action.type === 'page-create' || action.type === 'task-complete') {
                if (segmentBuffer.trim().length > 0) {
                  const textToGen = segmentBuffer
                  segmentBuffer = ''
                  triggerVideoGen(textToGen)
                  segmentThreshold = 300
                }
              }
              resolve(action)
              emit(action)
            },
            resources: input.options.resources || [],
            apiKey,
            baseURL,
            model,
            provider,
            signal: controller.signal,
          })

          // Final flush
          if (segmentBuffer.length > 0) {
            triggerVideoGen(segmentBuffer)
          }

          await updateChatRecord({
            id,
            context: {
              agent: agentContext,
            },
            messages,
            pages,
          })
          await updateChatStatus(id, Status.COMPLETED)
        }
      } catch (error: any) {
        if (controller) {
          await updateChatRecord({
            id,
            context: {
              agent: agentContext,
            },
            messages,
            pages,
          })
        }
        const isAbort = error.name === 'AbortError' || error.message?.includes('aborted')
        await updateChatStatus(id, isAbort ? Status.COMPLETED : Status.FAILED)
        throw error
      } finally {
        if (controller && !controller.signal.aborted) {
          controller.abort()
        }
        controller = null
      }
    },
  }
}
