import { Elysia } from 'elysia'
import { SubmitQuestionModel, GetQuestionsModel } from './model'
import { submitQuestion, getExternalQuestions, getExternalQuestion, searchQuestionsByVector, searchQuestionsByKeyword } from './service'

export const external = new Elysia({ prefix: '/external' })

// 外部接口：提交题目
.post('/submit', async ({ body }) => {
  const { uuid, content, imageUrl, title } = body as any
  const questionType = (body.typ && body.typ.trim()) ? body.typ.trim() : 'error'
  
  const result = await submitQuestion({
    uuid,
    typ: questionType,
    content,
    imageUrl,
    title,
  })
  
  const baseUrl = 'http://117.50.196.232:8001'
  const typeMsg = questionType === 'error' ? '错题' : questionType === 'test' ? '考试题' : questionType === 'example' ? '例题' : '日常问答' 
  
  return {
    success: true,
    id: result.id,
    message: `${typeMsg}已收集，访问 http://${baseUrl.replace('http://', '')}/chat/${result.id} 查看最新讲解`
  }
}, SubmitQuestionModel)

// 外部接口：获取题目列表
.get('/questions', async ({ query }) => {
  const questions = await getExternalQuestions(
    Number(query.limit) || 10,
    Number(query.offset) || 0,
    query.uuid,
    query.typ
  )
  return questions
}, GetQuestionsModel)

// 外部接口：获取单个题目详情
.get('/questions/:id', async ({ params }) => {
  const question = await getExternalQuestion(params.id)
  if (!question) {
    return { success: false, error: 'Question not found' }
  }
  return question
})



// 外部接口：搜索题目（支持关键词和向量）
// 关键词搜索: /search?title=xxx
// 向量搜索: /search?key=xxx (根据语义搜索)
.get('/search', async ({ query }) => {
  const { key, title, uuid, typ, limit } = query as any
  
  // 向量搜索
  if (key) {
    const results = await searchQuestionsByVector(key, uuid, typ, Number(limit) || 10)
    return { success: true, type: 'vector', results }
  }
  
  // 关键词搜索
  if (title) {
    const results = await searchQuestionsByKeyword(title, uuid, typ, Number(limit) || 10)
    return { success: true, type: 'keyword', results }
  }
  
  return { success: false, error: 'Missing key or title parameter' }
})

// 健康检查
.get('/health', () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})
