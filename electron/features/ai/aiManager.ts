import { APP_CONFIG } from '../../main/constants'
import type {
    SubmitMode,
    AiSelectorConfig,
    AiPlatformMeta,
    AiPlatform,
    EnhancedAiPlatform,
    AiRegistry,
    InactivePlatforms
} from '@shared/types'
import chatgpt from './platforms/chatgpt'
import claude from './platforms/claude'
import deepseek from './platforms/deepseek'
import qwen from './platforms/qwen'

// Re-export types for backward compatibility
export type { SubmitMode, AiSelectorConfig, AiPlatformMeta, AiPlatform, EnhancedAiPlatform, AiRegistry, InactivePlatforms }




/**
 * AI Modül Yöneticisi (Registry)
 * Tüm AI platformlarını tek bir noktadan yönetir ve dışa aktarır.
 */

const { CHROME_USER_AGENT } = APP_CONFIG

const AUTH_DOMAINS = new Set([
    'auth.openai.com', 'auth0.openai.com', 'platform.openai.com',
    'login.microsoftonline.com', 'login.live.com', 'login.x.com',
    'challenges.cloudflare.com',
])

const isAuthDomain = (hostname?: string) => {
    if (!hostname) return false
    const normalized = hostname.toLowerCase().trim()
    if (AUTH_DOMAINS.has(normalized)) return true

    // Check for subdomains
    return Array.from(AUTH_DOMAINS).some(domain => normalized.endsWith('.' + domain))
}

const enhancePlatform = (data: AiPlatform): EnhancedAiPlatform => {
    return {
        ...data,
        displayName: data.meta?.displayName || data.name,
        submitMode: data.meta?.submitMode,
        domainRegex: data.meta?.domainRegex,
        imageWaitTime: data.meta?.imageWaitTime,
        input: data.selectors?.input,
        button: data.selectors?.button,
        waitFor: data.selectors?.waitFor
    }
}

// Tüm platformların haritası
// Active Platforms (Defaults)
const platforms: AiRegistry = {
    chatgpt: enhancePlatform(chatgpt),
    deepseek: enhancePlatform(deepseek),
    qwen: enhancePlatform(qwen),
    claude: enhancePlatform(claude)
}

// Inactive/Removed Platforms (Kept for icon/meta recovery if user adds them back)
const inactivePlatforms: InactivePlatforms = {
    copilot: {
        id: 'copilot',
        name: 'Copilot',
        url: 'https://copilot.microsoft.com',
        partition: 'persist:ai_copilot',
        icon: 'copilot',
        color: '#00a4ef',
        meta: { displayName: 'Copilot', domainRegex: '^https://copilot\\.microsoft\\.com(/conversation)?/?$' }
    },
    grok: {
        id: 'grok',
        name: 'Grok',
        url: 'https://grok.com',
        partition: 'persist:ai_grok',
        icon: 'grok',
        color: '#ffffff',
        meta: { displayName: 'Grok', domainRegex: '^https://(www\\.)?grok\\.com(/chat(/[a-zA-Z0-9-]+)?)?/?$' }
    },
    huggingchat: {
        id: 'huggingchat',
        name: 'HuggingChat',
        url: 'https://huggingface.co/chat',
        partition: 'persist:ai_huggingchat',
        icon: 'huggingchat',
        color: '#ffb300',
        meta: { displayName: 'HuggingChat', domainRegex: '^https://huggingface\\.co/chat(/conversation/[a-zA-Z0-9-]+)?/?$' }
    },
    kimi: {
        id: 'kimi',
        name: 'Kimi',
        url: 'https://kimi.moonshot.cn',
        partition: 'persist:ai_kimi',
        icon: 'kimi',
        color: '#ff6b6b',
        meta: { displayName: 'Kimi', domainRegex: '^https://(kimi\\.moonshot\\.cn|kimi\\.com)(/chat(/[a-zA-Z0-9]+)?)?/?$' }
    },
    manus: {
        id: 'manus',
        name: 'Manus',
        url: 'https://manus.im',
        partition: 'persist:ai_manus',
        icon: 'manus',
        color: '#9333ea',
        meta: { displayName: 'Manus', domainRegex: '^https://(www\\.)?manus\\.im(/chat(/[a-zA-Z0-9-]+)?)?/?$' }
    },
    mistral: {
        id: 'mistral',
        name: 'Mistral',
        url: 'https://chat.mistral.ai',
        partition: 'persist:ai_mistral',
        icon: 'mistral',
        color: '#fd7e14',
        meta: { displayName: 'Mistral', domainRegex: '^https://chat\\.mistral\\.ai(/chat(/[a-zA-Z0-9-]+)?)?/?$' }
    },
    perplexity: {
        id: 'perplexity',
        name: 'Perplexity',
        url: 'https://perplexity.ai',
        partition: 'persist:ai_perplexity',
        icon: 'perplexity',
        color: '#19bd9b',
        meta: { displayName: 'Perplexity', domainRegex: '^https://(www\\.)?perplexity\\.ai(/search(/[a-zA-Z0-9-]+)?)?/?$' }
    },

}

const AI_REGISTRY: AiRegistry = platforms

const DEFAULT_AI_ID = 'chatgpt'

const GET_AI_CONFIG = (id: string): EnhancedAiPlatform => {
    return platforms[id] || platforms[DEFAULT_AI_ID]
}

const GET_ALL_AI_IDS = (): string[] => Object.keys(platforms)

export {
    CHROME_USER_AGENT,
    isAuthDomain,
    AI_REGISTRY,
    DEFAULT_AI_ID,
    GET_AI_CONFIG,
    GET_ALL_AI_IDS,
    inactivePlatforms as INACTIVE_PLATFORMS
}
