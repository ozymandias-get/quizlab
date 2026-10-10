import type { AiSelectorConfig } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { Logger } from '@shared/lib/logger'

import { PICKER_SCRIPTS } from '../lib/automationConstants'

function hasElementIdentity(fingerprint: unknown): boolean {
  if (!fingerprint || typeof fingerprint !== 'object') return false
  const candidate = fingerprint as { tag?: unknown }
  return typeof candidate.tag === 'string' && candidate.tag.length > 0
}

export function isPickerConfig(value: unknown): value is AiSelectorConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AiSelectorConfig>
  // Target integrity: fingerprints alone only prove *something* was probed.
  // A persistable config must also carry non-empty selectors for BOTH
  // locators (the picker always produces them, including the bare-tag
  // fallback) plus fingerprints with real element identity (a tag). Anything
  // less is a missing/wrong target and must surface picker_selection_missing
  // instead of being saved as a valid configuration.
  if (typeof candidate.input !== 'string' || candidate.input.length === 0) return false
  if (typeof candidate.button !== 'string' || candidate.button.length === 0) return false
  return (
    hasElementIdentity(candidate.inputFingerprint) &&
    hasElementIdentity(candidate.buttonFingerprint)
  )
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
