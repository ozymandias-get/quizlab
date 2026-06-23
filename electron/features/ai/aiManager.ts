import type {
  AiPlatform,
  AiPlatformMeta,
  AiRegistry,
  AiSelectorConfig,
  InactivePlatforms,
  SubmitMode
} from '@shared-core/types'

import { normalizeSubmitMode } from '../../../shared/selectorConfig'
import { APP_CONFIG } from '../../app/constants'
import aistudio from './platforms/aistudio'
import chatgpt from './platforms/chatgpt'
import claude from './platforms/claude'
import deepseek from './platforms/deepseek'
import gemini from './platforms/gemini'
import kimi from './platforms/kimi'
import m365 from './platforms/m365'
import qwen from './platforms/qwen'
import youtube from './platforms/youtube'

/**
 * AI Modül Yöneticisi (Registry)
 */

const { CHROME_USER_AGENT } = APP_CONFIG

const AUTH_DOMAINS = new Set([
  'accounts.google.com',
  'myaccount.google.com',
  'auth.openai.com',
  'auth0.openai.com',
  'platform.openai.com',
  'login.microsoftonline.com',
  'login.live.com',
  'login.x.com',
  'challenges.cloudflare.com',
  'cdn.cloudflare.com'
])

const isAuthDomain = (hostname?: string) => {
  if (!hostname) return false
  const normalized = hostname.toLowerCase().trim()
  if (AUTH_DOMAINS.has(normalized)) return true

  return [...AUTH_DOMAINS].some((domain) => normalized.endsWith('.' + domain))
}

const enhancePlatform = (data: AiPlatform): AiPlatform => {
  return {
    ...data,
    displayName: data.meta?.displayName || data.name,
    submitMode: normalizeSubmitMode(data.meta?.submitMode) || 'mixed',
    domainRegex: data.meta?.domainRegex,
    imageWaitTime: data.meta?.imageWaitTime,
    appendPromptAfterPaste: data.meta?.appendPromptAfterPaste !== false,
    input: data.selectors?.input,
    button: data.selectors?.button,
    waitFor: data.selectors?.waitFor
  }
}

const platforms: AiRegistry = {
  chatgpt: enhancePlatform(chatgpt),
  gemini: enhancePlatform(gemini),
  aistudio: enhancePlatform(aistudio),
  youtube: enhancePlatform(youtube),
  deepseek: enhancePlatform(deepseek),
  qwen: enhancePlatform(qwen),
  claude: enhancePlatform(claude),
  kimi: enhancePlatform(kimi),
  m365: enhancePlatform(m365),
  'api-chat': {
    id: 'api-chat',
    name: 'API Chat',
    displayName: 'API Chat',
    url: '',
    icon: 'api-chat',
    color: '#f59e0b',
    submitMode: 'enter_key'
  }
}

const inactivePlatforms: InactivePlatforms = {
  copilot: {
    id: 'copilot',
    name: 'Copilot',
    url: 'https://copilot.microsoft.com',
    partition: 'persist:ai_copilot',
    icon: 'copilot',
    color: '#00a4ef',
    meta: {
      displayName: 'Copilot',
      domainRegex: '^https://copilot\\.microsoft\\.com(/conversation)?/?$'
    }
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    partition: 'persist:ai_grok',
    icon: 'grok',
    color: '#ffffff',
    meta: {
      displayName: 'Grok',
      domainRegex: '^https://(www\\.)?grok\\.com(/chat(/[a-zA-Z0-9-]+)?)?/?$'
    }
  },
  huggingchat: {
    id: 'huggingchat',
    name: 'HuggingChat',
    url: 'https://huggingface.co/chat',
    partition: 'persist:ai_huggingchat',
    icon: 'huggingchat',
    color: '#ffb300',
    meta: {
      displayName: 'HuggingChat',
      domainRegex: '^https://huggingface\\.co/chat(/conversation/[a-zA-Z0-9-]+)?/?$'
    }
  },

  manus: {
    id: 'manus',
    name: 'Manus',
    url: 'https://manus.im',
    partition: 'persist:ai_manus',
    icon: 'manus',
    color: '#9333ea',
    meta: {
      displayName: 'Manus',
      domainRegex: '^https://(www\\.)?manus\\.im(/chat(/[a-zA-Z0-9-]+)?)?/?$'
    }
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    url: 'https://chat.mistral.ai',
    partition: 'persist:ai_mistral',
    icon: 'mistral',
    color: '#fd7e14',
    meta: {
      displayName: 'Mistral',
      domainRegex: '^https://chat\\.mistral\\.ai(/chat(/[a-zA-Z0-9-]+)?)?/?$'
    }
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://perplexity.ai',
    partition: 'persist:ai_perplexity',
    icon: 'perplexity',
    color: '#19bd9b',
    meta: {
      displayName: 'Perplexity',
      domainRegex: '^https://(www\\.)?perplexity\\.ai(/search(/[a-zA-Z0-9-]+)?)?/?$'
    }
  }
}

const AI_REGISTRY: AiRegistry = platforms

const DEFAULT_AI_ID = 'chatgpt'

const GET_AI_CONFIG = (id: string): AiPlatform => {
  return platforms[id] || platforms[DEFAULT_AI_ID]
}

export {
  AI_REGISTRY,
  CHROME_USER_AGENT,
  DEFAULT_AI_ID,
  inactivePlatforms as INACTIVE_PLATFORMS,
  isAuthDomain
}
