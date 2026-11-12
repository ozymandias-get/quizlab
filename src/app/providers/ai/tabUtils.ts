import type { StoredAiTab } from './types'

export const sanitizeStoredTabs = (rawTabs: unknown, validModelIds: string[]): StoredAiTab[] => {
  if (!Array.isArray(rawTabs)) return []

  const validModelSet = new Set(validModelIds)
  const seenIds = new Set<string>()
  const sanitized: StoredAiTab[] = []

  for (const rawTab of rawTabs) {
    if (!rawTab || typeof rawTab !== 'object') continue

    const maybeTab = rawTab as Partial<StoredAiTab>
    const id = typeof maybeTab.id === 'string' ? maybeTab.id.trim() : ''
    const modelId = typeof maybeTab.modelId === 'string' ? maybeTab.modelId.trim() : ''

    if (!id || !modelId || !validModelSet.has(modelId) || seenIds.has(id)) continue
    seenIds.add(id)
    sanitized.push({ id, modelId })
  }

  return sanitized
}

export const areStoredTabsEqual = (a: StoredAiTab[], b: StoredAiTab[]) => {
  if (a.length !== b.length) return false

  for (let index = 0; index < a.length; index += 1) {
    if (a[index].id !== b[index].id || a[index].modelId !== b[index].modelId) return false
  }

  return true
}

export const areStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false
  }

  return true
}
