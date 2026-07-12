import type { AiSelectorConfig } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

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

export async function resetPickerArtifacts(webview: WebviewController | null): Promise<void> {
  if (!webview || typeof webview.executeJavaScript !== 'function') {
    return
  }
  try {
    await webview.executeJavaScript(PICKER_SCRIPTS.CLEANUP)
  } catch (error) {
    Logger.warn('[ElementPicker] cleanup script failed', error)
  }
}
