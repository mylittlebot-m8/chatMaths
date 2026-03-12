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

  return (modelId: string) => {
    if (provider === 'openai' || provider === 'qwen') {
      return (providerInstance as any).chat(modelId)
    }
    return (providerInstance as any)(modelId)
  }
}