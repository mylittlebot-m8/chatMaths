import process from 'process'

const getEnv = (key: string): string => {
  // Bun 环境下使用 globalThis.Bun
  if (typeof Bun !== 'undefined') {
    return Bun.env[key] || ''
  }
  return process.env[key] || ''
}

const API_KEY = getEnv('MODEL_API_KEY')
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings'
const MODEL = 'text-embedding-v3'
const BASE_URL = getEnv('MODEL_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const AGENT_MODEL = getEnv('AGENT_MODEL') || 'qwen3.5-397b-a17b'

export interface EmbeddingResult {
  embedding: number[]
  success: boolean
  error?: string
}

/**
 * 生成文本向量
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!API_KEY) {
    return { embedding: [], success: false, error: 'No API_KEY' }
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: text,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      embedding: data.data[0].embedding,
      success: true,
    }
  } catch (error) {
    return {
      embedding: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 提取题目知识点（使用 LLM）
 */
export async function extractConcepts(
  question: string,
  solve: string
): Promise<{ concept: string; success: boolean }> {
  if (!API_KEY) {
    return { concept: '', success: false }
  }
  
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个数学教学助手。从给定的题目和解题过程中，提取核心知识点。用逗号分隔，返回纯文本知识点列表。只返回知识点，不要其他内容。'
          },
          {
            role: 'user',
            content: `题目：${question}\n\n解题过程：${solve}\n\n请提取核心知识点（用中文逗号分隔）：`
          }
        ],
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const concept = data.choices[0].message.content.trim()
    
    return { concept, success: true }
  } catch (error) {
    return {
      concept: '',
      success: false,
    }
  }
}

/**
 * 为题目生成向量数据
 */
export async function generateQuestionVectors(
  question: string,
  solve: string
): Promise<{
  textEmbedding: number[] | null
  solveEmbedding: number[] | null
  concept: string
  conceptEmbedding: number[] | null
}> {
  // 并行生成所有向量
  const [textResult, solveResult, conceptResult] = await Promise.all([
    generateEmbedding(question),
    generateEmbedding(solve),
    extractConcepts(question, solve),
  ])

  // 如果提取了知识点，生成知识点向量
  let conceptEmbResult = null
  if (conceptResult.success && conceptResult.concept) {
    conceptEmbResult = await generateEmbedding(conceptResult.concept)
  }

  return {
    textEmbedding: textResult.success ? textResult.embedding : null,
    solveEmbedding: solveResult.success ? solveResult.embedding : null,
    concept: conceptResult.success ? conceptResult.concept : '',
    conceptEmbedding: conceptEmbResult?.success ? conceptEmbResult.embedding : null,
  }
}
