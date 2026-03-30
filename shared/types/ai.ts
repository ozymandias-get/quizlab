/**
 * AI Platform & Registry Types
 */

import type { SubmitMode } from './automation'

export type AiPlatformMeta = {
  displayName?: string
  submitMode?: SubmitMode
  domainRegex?: string
  imageWaitTime?: number
  /**
   * false: görsel sonrası ek not tüm kutuyu yeniden yazar (eski davranış).
   * Varsayılan: true — tüm platformlarda metin sona eklenir (Quill vb. ile uyumlu).
   */
  appendPromptAfterPaste?: boolean
}

export type AiPlatform = {
  id: string
  name: string
  url: string
  isSite?: boolean
  partition?: string
  icon?: string
  color?: string
  displayName?: string
  submitMode?: SubmitMode
  domainRegex?: string
  imageWaitTime?: number
  appendPromptAfterPaste?: boolean
  input?: string | null
  button?: string | null
  waitFor?: string | null
  selectors?: {
    input?: string | null
    button?: string | null
    waitFor?: string | null
  }
  meta?: AiPlatformMeta
  isCustom?: boolean
  [key: string]: unknown
}

export type EnhancedAiPlatform = AiPlatform & {
  displayName?: string
  submitMode?: SubmitMode
  domainRegex?: string
  imageWaitTime?: number
  appendPromptAfterPaste?: boolean
  input?: string | null
  button?: string | null
  waitFor?: string | null
}

export type AiRegistry = Record<string, EnhancedAiPlatform>
export type InactivePlatforms = Record<string, AiPlatform>

export type AiRegistryResponse = {
  aiRegistry: Record<string, AiPlatform>
  defaultAiId: string
  allAiIds: string[]
  chromeUserAgent: string
}

export type CustomAiInput = { name: string; url: string; isSite?: boolean }
export type CustomAiResult = {
  success: boolean
  id?: string
  platform?: AiPlatform
  error?: string
}

// Re-export AiSelectorConfig from automation for convenience
export type { AiSelectorConfig } from './automation'
