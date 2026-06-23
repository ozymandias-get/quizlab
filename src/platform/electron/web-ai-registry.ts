import type { AiPlatform } from '@shared-core/types'

export const WEB_AI_REGISTRY: Record<string, AiPlatform> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    displayName: 'ChatGPT',
    url: 'https://chatgpt.com',
    color: '#10a37f',
    submitMode: 'mixed'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    displayName: 'Gemini',
    url: 'https://gemini.google.com/app',
    color: '#4285f4',
    submitMode: 'mixed'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    displayName: 'Claude',
    url: 'https://claude.ai',
    color: '#d97706',
    submitMode: 'click'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    displayName: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    color: '#4f46e5',
    submitMode: 'mixed'
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen',
    displayName: 'Qwen',
    url: 'https://chat.qwenlm.ai',
    color: '#6366f1',
    submitMode: 'click'
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    displayName: 'Kimi',
    url: 'https://kimi.com',
    color: '#f97316',
    submitMode: 'enter_key'
  },
  aistudio: {
    id: 'aistudio',
    name: 'AI Studio',
    displayName: 'AI Studio',
    url: 'https://aistudio.google.com/welcome',
    icon: 'aistudio',
    color: '#4285f4',
    submitMode: 'mixed'
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    displayName: 'YouTube',
    url: 'https://www.youtube.com/',
    icon: 'youtube',
    isSite: true,
    color: '#ff0033',
    submitMode: 'mixed'
  },
  m365: {
    id: 'm365',
    name: 'M365 Copilot',
    displayName: 'M365 Copilot',
    url: 'https://m365.cloud.microsoft/chat',
    icon: 'copilot',
    color: '#00a4ef',
    submitMode: 'mixed'
  },
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
