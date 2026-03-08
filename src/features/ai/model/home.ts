import type { AiPlatform } from '@shared-core/types'

export type SectionTone = 'model' | 'site'
export type AiSiteMap = Record<string, AiPlatform | undefined>

const HEX_COLOR_REGEX = /^#([0-9A-F]{3}){1,2}$/i
const DEFAULT_AI_ACCENT = '#6ee7b7'

function areIdsEqual(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index])
}

export function safeAiAccentColor(color?: string) {
    return color && HEX_COLOR_REGEX.test(color) ? color : DEFAULT_AI_ACCENT
}

export function mergeOrderedIds(previous: string[], nextIds: string[]) {
    const next = [
        ...previous.filter((id) => nextIds.includes(id)),
        ...nextIds.filter((id) => !previous.includes(id))
    ]

    return areIdsEqual(previous, next) ? previous : next
}

export function getEnabledAiIdsByType(
    enabledModels: string[],
    aiSites: AiSiteMap,
    tone: SectionTone
) {
    return enabledModels.filter((id) => {
        const site = aiSites[id]
        if (!site) {
            return false
        }

        return tone === 'site' ? site.isSite : !site.isSite
    })
}

export function getFeaturedAiIds(modelOrder: string[], siteOrder: string[]) {
    return [...modelOrder.slice(0, 3), ...siteOrder.slice(0, 2)]
}
