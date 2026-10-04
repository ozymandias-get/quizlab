import type { AiSelectorConfig } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { Logger } from '@shared/lib/logger'

import { PICKER_SCRIPTS } from '../lib/automationConstants'

export function isPickerConfig(value: unknown): value is AiSelectorConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AiSelectorConfig>
  return Boolean(candidate.inputFingerprint && candidate.buttonFingerprint)
}

export interface UseElementPickerReturn {
  isPickerActive: boolean
  startPicker: () => Promise<void>
  stopPicker: () => Promise<void>
  togglePicker: () => Promise<void>
}

export async function resetPickerArtifacts(content: AiContentController | null): Promise<void> {
  if (!content || typeof content.executeJavaScript !== 'function') {
    return
  }
  try {
    await content.executeJavaScript(PICKER_SCRIPTS.CLEANUP)
  } catch (error) {
    Logger.warn('[ElementPicker] cleanup script failed', error)
  }
}
