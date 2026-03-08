import type { PinnedTabStorage } from './types'

export const normalizeTitle = (title?: string): string | undefined => {
    const normalized = title?.trim()
    return normalized ? normalized : undefined
}

export const sanitizePinnedTabs = (
    rawTabs: unknown,
    validModelIds: string[]
): PinnedTabStorage[] => {
    if (!Array.isArray(rawTabs)) return []

    const validModelSet = new Set(validModelIds)
    const seenIds = new Set<string>()
    const sanitized: PinnedTabStorage[] = []

    for (const rawTab of rawTabs) {
        if (!rawTab || typeof rawTab !== 'object') continue

        const maybeTab = rawTab as Partial<PinnedTabStorage>
        const id = typeof maybeTab.id === 'string' ? maybeTab.id.trim() : ''
        const modelId = typeof maybeTab.modelId === 'string' ? maybeTab.modelId.trim() : ''
        const title = normalizeTitle(maybeTab.title)

        if (!id || !modelId || !validModelSet.has(modelId) || seenIds.has(id)) continue
        seenIds.add(id)
        sanitized.push({ id, modelId, title })
    }

    return sanitized
}

export const arePinnedTabsEqual = (a: PinnedTabStorage[], b: PinnedTabStorage[]) => {
    if (a.length !== b.length) return false

    for (let index = 0; index < a.length; index += 1) {
        if (
            a[index].id !== b[index].id ||
            a[index].modelId !== b[index].modelId ||
            normalizeTitle(a[index].title) !== normalizeTitle(b[index].title)
        ) {
            return false
        }
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
