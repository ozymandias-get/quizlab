import type { RecentItemGroup, RecentItemView, SortMode } from './types'

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

export const formatRelativeTime = (timestamp: number, language: string): string => {
  const locale = language === 'en' ? 'en-US' : 'tr-TR'
  const diffMs = timestamp - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (absMs < WEEK_IN_MS) return rtf.format(Math.round(diffMs / day), 'day')
  return rtf.format(Math.round(diffMs / WEEK_IN_MS), 'week')
}

export const getProgressRatio = (page: number, totalPages: number): number => {
  if (!totalPages || totalPages <= 0) return 0.08
  const ratio = page / totalPages
  return Math.max(0.08, Math.min(ratio, 1))
}

export const processRecentItems = (
  recentItems: RecentItemView[],
  searchQuery: string,
  sortMode: SortMode,
  language: string
) => {
  const query = searchQuery.trim().toLowerCase()
  const filtered =
    query.length > 0
      ? recentItems.filter((item) => item.name.toLowerCase().includes(query))
      : recentItems

  return filtered.sort((a, b) => {
    if (sortMode === 'name') {
      return a.name.localeCompare(b.name, language)
    }

    const aTs = a.lastOpenedAt || 0
    const bTs = b.lastOpenedAt || 0
    if (aTs === bTs) return a.originalIndex - b.originalIndex
    return bTs - aTs
  })
}

export const groupRecentItems = (processedItems: RecentItemView[]): RecentItemGroup[] => {
  const hasTimestamp = processedItems.some(
    (item) => typeof item.lastOpenedAt === 'number' && item.lastOpenedAt > 0
  )
  if (!hasTimestamp) {
    return [{ id: 'all', labelKey: null, items: processedItems }]
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStartMs = todayStart.getTime()
  const weekStartMs = todayStartMs - WEEK_IN_MS
  const today: RecentItemView[] = []
  const week: RecentItemView[] = []
  const older: RecentItemView[] = []

  processedItems.forEach((item) => {
    const ts = item.lastOpenedAt || 0
    if (ts >= todayStartMs) {
      today.push(item)
    } else if (ts >= weekStartMs) {
      week.push(item)
    } else {
      older.push(item)
    }
  })

  return [
    { id: 'today', labelKey: 'recent_group_today', items: today },
    { id: 'week', labelKey: 'recent_group_week', items: week },
    { id: 'older', labelKey: 'recent_group_older', items: older }
  ].filter((group) => group.items.length > 0)
}
