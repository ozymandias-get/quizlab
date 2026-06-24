import type {
  AiPlatform,
  AiPlatformMeta,
  AiRegistry,
  AiSelectorConfig,
  InactivePlatforms,
  SubmitMode
} from '@shared-core/types'

import { normalizeSubmitMode } from '../../../shared/selectorConfig.js'
import { APP_CONFIG } from '../../app/constants.js'
import aistudio from './platforms/aistudio.js'
import chatgpt from './platforms/chatgpt.js'
import claude from './platforms/claude.js'
import deepseek from './platforms/deepseek.js'
import gemini from './platforms/gemini.js'
import kimi from './platforms/kimi.js'
import m365 from './platforms/m365.js'
import qwen from './platforms/qwen.js'
import youtube from './platforms/youtube.js'

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

const enhancePlatform = (platform: AiPlatform): AiPlatform => {
  return {
    ...platform,
    displayName: platform.meta?.displayName || platform.name,
    submitMode: normalizeSubmitMode(platform.meta?.submitMode) || 'mixed',
    domainRegex: platform.meta?.domainRegex,
    imageWaitTime: platform.meta?.imageWaitTime,
    appendPromptAfterPaste: platform.meta?.appendPromptAfterPaste !== false,
    input: platform.selectors?.input,
    button: platform.selectors?.button,
    waitFor: platform.selectors?.waitFor
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
} as const

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
} as const

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
