import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { AgentProvider } from './types'

export interface GatewayOptions {
  apiKey: string
  baseURL: string
  provider?: AgentProvider
}

export const createGateway = ({ apiKey, baseURL, provider = 'openai' }: GatewayOptions) => {
  const providers = {
    'openai': createOpenAI,
    'anthropic': createAnthropic,
    'deepseek': createDeepSeek,
    'qwen': createOpenAI,
  }

  const providerInstance = providers[provider]({
    apiKey,
    baseURL,
  })

  return (modelId: string, options?: { vision?: boolean }) => {
    if (provider === 'openai' || provider === 'qwen') {
      // 多模态支持
      if (options?.vision) {
        return (providerInstance as any).chat(modelId, { vision: { support: true } })
      }
      return (providerInstance as any).chat(modelId)
    }
    return (providerInstance as any)(modelId)
  }
}