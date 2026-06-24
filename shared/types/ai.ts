/**
 * AI Platform & Registry Types
 */

import type { IpcResult } from '../lib/typedIpc.js'
import type { SubmitMode } from './automation.js'

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

export type AiRegistry = Record<string, AiPlatform>
export type InactivePlatforms = Record<string, AiPlatform>

export type AiRegistryResponse = {
  aiRegistry: Record<string, AiPlatform>
  defaultAiId: string
  allAiIds: string[]
  chromeUserAgent: string
}

export type CustomAiInput = { name: string; url: string; isSite?: boolean }
type CustomAiPayload = {
  id: string
  platform: AiPlatform
}

export type CustomAiResult = IpcResult<CustomAiPayload>

export type ClearAiModelDataInput = {
  id: string
  partition?: string
}
