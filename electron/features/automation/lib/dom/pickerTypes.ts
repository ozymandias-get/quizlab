import type { AutomationElementFingerprint } from '@shared-core/types'

export type PickerCategory = 'input' | 'button' | 'container' | 'icon' | 'text' | 'unknown'
export type PickerConfidence = 'high' | 'medium' | 'low'

export interface PickerElementInfo {
  category: PickerCategory
  labelEN: string
  labelKey?: string
  confidence: PickerConfidence
  tag: string
  hintKey?: string
  hintEN?: string
}

export interface LocatorBundle {
  primarySelector: string | null
  candidates: string[]
  fingerprint: AutomationElementFingerprint
}

export type PickerElement = Element & {
  isContentEditable?: boolean
  onclick?: ((this: GlobalEventHandlers, ev: MouseEvent) => unknown) | null
}
