import { chat } from '@chat-tutor/db/schema'
import { db } from '@chat-tutor/db'
import { eq, sql, and } from 'drizzle-orm'
import { generateEmbedding as getEmbedding } from '../../utils/embedding'

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
    
    // 构建消息 - 要求返回结构化内容
    const systemPrompt = `你是一个专业的数学辅导老师。请按以下格式解答用户提交的题目：

请先识别并提取题目中的数学问题，然后用<problem>标签包裹识别的题目内容，最后进行解答。

输出格式：
<problem>题目内容（精简描述）</problem>
<solution>详细解答步骤</solution>

注意：
1. <problem>中只包含题目本身的关键信息，不要包含解答
2. 用中文输出
3. 如果是图片题，从图片中识别题目`

    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ]
    
    // 如果有图片，添加图片消息
    if (imageUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: content },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      })
    } else {
      messages.push({ role: 'user', content })
    }
    
    // 调用大模型
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
    
    const responseText = await response.text()
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('[External] Invalid JSON:', responseText.substring(0, 200))
      await db.update(chat).set({ status: 'failed' }).where(eq(chat.id, id))
      return
    }
    
    if (!response.ok) {
      console.error('[External] API Error:', response.status, data)
      await db.update(chat).set({ status: 'failed' }).where(eq(chat.id, id))
      return
    }
    
    const answer = data.choices[0].message.content
    
    // 从答案中提取 <problem> 标签内容
    const problemMatch = answer.match(/<problem>([\s\S]*?)<\/problem>/)
    const extractedProblem = problemMatch ? problemMatch[1].trim() : content
    
    // 提取解题内容
    const solveContent = answer.replace(/<problem>[\s\S]*?<\/problem>/g, '').trim()
    
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
    
    // 使用AI返回的准确题目生成向量
    try {
      const embedResult = await getEmbedding(extractedProblem + ' ' + solveContent.slice(0, 500))
      if (embedResult.success && embedResult.embedding) {
        const vectorStr = '[' + embedResult.embedding.join(',') + ']'
        await db.execute(sql`UPDATE chat SET text_embedding = ${vectorStr}::vector WHERE id = ${id}`)
        console.log('[External] Vector generated from extracted problem:', id)
      }
    } catch (e) {
      console.error('[External] Failed to generate vector:', e)
    }
    
    console.log('[External] Question processed:', id, 'imageUrl:', imageUrl)
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


// 外部接口：向量搜索题目
export const searchQuestionsByVector = async (
  key: string,
  uuid?: string,
  typ?: string,
  limit: number = 10
) => {
  try {
    // 生成查询词的向量
    console.log('[Vector Search] key:', key)
    const embedResult = await getEmbedding(key)
    console.log('[Vector Search] result:', embedResult)
    if (!embedResult || !embedResult.success) {
      throw new Error('Failed to generate embedding: ' + embedResult?.error)
    }
    const embedding = embedResult.embedding
    console.log('[Vector Search] embedding length:', embedding?.length)
    if (!embedding) {
      throw new Error('Failed to generate embedding')
    }
    
    // 构建向量数组字符串
    const vectorStr = '[' + embedding.join(',') + ']'
    
    let sqlWhere = `text_embedding IS NOT NULL`
    
    if (uuid) {
      sqlWhere += ` AND user_id = '${uuid}'`
    }
    if (typ) {
      sqlWhere += ` AND type = '${typ}'`
    }
    
    const sqlQuery = `
      SELECT id, title, user_id, type, status, created_at,
        1 - (text_embedding <=> '${vectorStr}'::vector) as similarity
      FROM chat
      WHERE ${sqlWhere}
      ORDER BY text_embedding <=> '${vectorStr}'::vector
      LIMIT ${limit}
    `
    
    // @ts-ignore
    const results = await db.execute(sqlQuery)
    return results.rows as any[]
  } catch (error) {
    console.error('Error searching questions by vector:', error)
    return []
  }
}

// 外部接口：按标题/内容关键词搜索
export const searchQuestionsByKeyword = async (
  keyword: string,
  uuid?: string,
  typ?: string,
  limit: number = 10
) => {
  try {
    let sqlWhere = `title ILIKE '%${keyword}%'`
    
    if (uuid) {
      sqlWhere += ` AND user_id = '${uuid}'`
    }
    if (typ) {
      sqlWhere += ` AND type = '${typ}'`
    }
    
    const sqlQuery = `SELECT id, title, user_id, type, status, created_at FROM chat WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT ${limit}`
    
    // @ts-ignore
    const results = await db.execute(sqlQuery)
    
    return results.rows as any[]
  } catch (error) {
    console.error('Error searching questions by keyword:', error)
    return []
  }
}