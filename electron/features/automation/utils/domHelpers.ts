export type {
  LocatorBundle,
  PickerCategory,
  PickerConfidence,
  PickerElementInfo
} from './dom/pickerTypes'

export { inferSendLikeControl, getElementInfo } from './dom/pickerClassification'
export { generateLocatorBundle } from './dom/locatorBundle'

import type { PickerElement } from './dom/pickerTypes'
import { generateLocatorBundle } from './dom/locatorBundle'
import { getElementInfo } from './dom/pickerClassification'

export function generateRobustSelector(el: Element | null): string | null {
  if (!el) return null
  const info = getElementInfo(el as PickerElement)
  const kind = info.category === 'button' ? 'button' : 'input'
  const bundle = generateLocatorBundle(el, kind)
  return bundle?.primarySelector || bundle?.fingerprint.localPath?.join(' > ') || null
}
