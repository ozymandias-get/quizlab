import type { Tab } from '@app/providers/AiContext'

const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i

export const isValidColor = (color: string) => hexColorRegex.test(color)
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const getVisibleTabIds = (tabs: Tab[], activeTabId: string): Set<string> => {
    if (tabs.length <= 3) {
        return new Set(tabs.map((tab) => tab.id))
    }

    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
    if (activeIndex <= 0) {
        return new Set([tabs[0].id, tabs[1].id, tabs[2].id])
    }
    if (activeIndex >= tabs.length - 1) {
        const last = tabs.length - 1
        return new Set([tabs[last - 2].id, tabs[last - 1].id, tabs[last].id])
    }

    return new Set([tabs[activeIndex - 1].id, tabs[activeIndex].id, tabs[activeIndex + 1].id])
}
