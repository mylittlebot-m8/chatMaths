import { chat } from '@chat-tutor/db/schema'
import { db } from '@chat-tutor/db'
import { eq } from 'drizzle-orm'

// 外部接口使用 ENV 中的配置
const MODEL_API_KEY = process.env.MODEL_API_KEY || ''
const VISION_MODEL = process.env.VISION_MODEL || process.env.AGENT_MODEL || 'qwen3.5-397b-a17b'
const MODEL_BASE_URL = process.env.MODEL_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'


interface SubmitQuestionInput {
  uuid?: string
  typ?: string
  content: string
  imageUrl?: string
  title?: string
}

interface QuestionRecord {
  id: string
  uuid?: string
  typ?: string
  content: string
  imageUrl?: string
  title?: string
  status: string
  createdAt: Date
}

/**
 * 外部接口：提交题目
 * 当外部机器人接收到错题/考试题时调用此接口
 */
export const submitQuestion = async (input: SubmitQuestionInput): Promise<{ id: string }> => {
  const { uuid, typ, content, imageUrl, title } = input
  
  // 生成标题
  const chatTitle = title || content.slice(0, 30) + (content.length > 30 ? '...' : '')
  
  // 创建聊天记录
  const [{ id }] = await db
    .insert(chat)
    .values({
      title: chatTitle,
      status: 'pending',
      userId: uuid || null,
      type: typ,
    })
    .returning({ id: chat.id })
  
  // 触发异步解题处理
  processQuestionAsync(id, content, imageUrl)
  
  return { id }
}

/**
 * 异步处理题目：调用大模型解题
 */
async function processQuestionAsync(id: string, content: string, imageUrl?: string) {
  const apiKey = MODEL_API_KEY
  const model = VISION_MODEL
  const baseUrl = MODEL_BASE_URL
  
  if (!apiKey) {
    console.error('[External] No API key configured')
    return
  }
  
  try {
    // 更新状态为处理中
    await db.update(chat).set({ status: 'processing' }).where(eq(chat.id, id))
    
    // 构建消息
    const messages: any[] = [
      { role: 'system', content: '你是一个专业的数学辅导老师。请解答用户提交的题目。' }
    ]
    
    // 如果有图片，添加图片消息
    if (imageUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: content },
          { type: 'image', image: imageUrl }
        ]
      })
    } else {
      messages.push({ role: 'user', content })
    }
    
    // 调用大模型 - 使用 DashScope 格式
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages,
        max_tokens: 4000,
      })
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    const answer = data.choices[0].message.content
    
    // 更新数据库
    const msgId1 = crypto.randomUUID()
    const msgId2 = crypto.randomUUID()
    await db.update(chat).set({
      status: 'completed',
      messages: [
        { id: msgId1, type: 'user', content },
        { id: msgId2, type: 'agent', content: answer }
      ]
    }).where(eq(chat.id, id))
    
    console.log('[External] Question processed:', id)
  } catch (error) {
    console.error('[External] Error processing question:', error)
    await db.update(chat).set({ status: 'failed' }).where(eq(chat.id, id))
  }
}


/**
 * 外部接口：获取题目列表
 */
export const getExternalQuestions = async (
  limit: number = 10, 
  offset: number = 0,
  uuid?: string,
  typ?: string
): Promise<QuestionRecord[]> => {
  try {
    let query = db.select({
      id: chat.id,
      title: chat.title,
      userId: chat.userId,
      type: chat.type,
      status: chat.status,
      createdAt: chat.createdAt,
    }).from(chat)
    
    // 构建条件
    if (uuid && typ) {
      query = query.where(eq(chat.userId, uuid)) as any
    } else if (uuid) {
      query = query.where(eq(chat.userId, uuid)) as any
    } else if (typ) {
      query = query.where(eq(chat.type, typ)) as any
    }
    
    const records = await query
      .limit(limit)
      .offset(offset)
      .orderBy(chat.createdAt)
    
    return records.map(r => ({
      id: r.id,
      uuid: r.userId || undefined,
      typ: r.type || 'days',
      content: r.title || '',
      status: r.status || 'pending',
      createdAt: r.createdAt,
    }))
  } catch (error) {
    console.error('Error getting external questions:', error)
    return []
  }
}

/**
 * 外部接口：获取单个题目详情
 */
export const getExternalQuestion = async (id: string): Promise<QuestionRecord | null> => {
  try {
    const records = await db
      .select({
        id: chat.id,
        title: chat.title,
        userId: chat.userId,
        type: chat.type,
        status: chat.status,
        createdAt: chat.createdAt,
        pages: chat.pages,
        messages: chat.messages,
      })
      .from(chat)
      .where(eq(chat.id, id))
      .limit(1)
    
    if (records.length === 0) return null
    
    const r = records[0]
    return {
      id: r.id,
      uuid: r.userId || undefined,
      typ: r.type || 'days',
      content: JSON.stringify(r.messages || []),
      status: r.status || 'pending',
      createdAt: r.createdAt,
    }
  } catch (error) {
    console.error('Error getting external question:', error)
    return null
  }
}
