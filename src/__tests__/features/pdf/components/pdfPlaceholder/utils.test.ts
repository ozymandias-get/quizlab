import type { RecentItemView } from '@features/pdf/ui/components/pdfPlaceholder/types'
import {
  formatRelativeTime,
  getProgressRatio,
  groupRecentItems,
  processRecentItems
} from '@features/pdf/ui/components/pdfPlaceholder/utils'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('getProgressRatio', () => {
  it('should return 0.08 for zero totalPages', () => {
    expect(getProgressRatio(5, 0)).toBe(0.08)
  })

  it('should return 0.08 for negative totalPages', () => {
    expect(getProgressRatio(5, -1)).toBe(0.08)
  })

  it('should return 0.08 for NaN totalPages', () => {
    expect(getProgressRatio(5, NaN)).toBe(0.08)
  })

  it('should return minimum 0.08 when page is very small relative to total', () => {
    expect(getProgressRatio(1, 1000)).toBe(0.08)
  })

  it('should return 1 for page equal to totalPages', () => {
    expect(getProgressRatio(100, 100)).toBe(1)
  })

  it('should return correct ratio for midpoint', () => {
    expect(getProgressRatio(50, 100)).toBe(0.5)
  })

  it('should clamp ratio above 1 to 1', () => {
    expect(getProgressRatio(150, 100)).toBe(1)
  })

  it('should return 0 for page 0', () => {
    const result = getProgressRatio(0, 100)
    expect(result).toBeGreaterThanOrEqual(0.08)
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should format minutes ago in Turkish', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    const result = formatRelativeTime(Date.now() - 5 * 60 * 1000, 'tr')
    expect(result).toContain('dakika')
  })

  it('should format hours ago in English', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    const result = formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000, 'en')
    expect(result).toContain('hour')
  })

  it('should format days ago in Turkish', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    const result = formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000, 'tr')
    expect(result).toContain('gün')
  })

  it('should format weeks ago in English', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    const result = formatRelativeTime(Date.now() - 14 * 24 * 60 * 60 * 1000, 'en')
    expect(result).toContain('week')
  })
})

describe('processRecentItems', () => {
  const makeItem = (name: string, lastOpenedAt?: number, originalIndex = 0): RecentItemView => ({
    name,
    path: `/path/${name}.pdf`,
    lastOpenedAt,
    originalIndex,
    page: 1,
    totalPages: 100
  })

  it('should return all items when search query is empty', () => {
    const items = [makeItem('A'), makeItem('B')]
    const result = processRecentItems(items, '', 'recent', 'en')
    expect(result.length).toBe(2)
  })

  it('should filter items by search query', () => {
    const items = [makeItem('Math'), makeItem('Science'), makeItem('History')]
    const result = processRecentItems(items, 'math', 'recent', 'en')
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('Math')
  })

  it('should be case-insensitive for search', () => {
    const items = [makeItem('MathBook')]
    const result = processRecentItems(items, 'MATHBOOK', 'recent', 'en')
    expect(result.length).toBe(1)
  })

  it('should sort by name when sortMode is name', () => {
    const items = [makeItem('Charlie'), makeItem('Alpha'), makeItem('Bravo')]
    const result = processRecentItems(items, '', 'name', 'en')
    expect(result[0].name).toBe('Alpha')
    expect(result[1].name).toBe('Bravo')
    expect(result[2].name).toBe('Charlie')
  })

  it('should sort by most recent first when sortMode is recent', () => {
    const items = [makeItem('Old', 1000, 0), makeItem('New', 5000, 1), makeItem('Mid', 3000, 2)]
    const result = processRecentItems(items, '', 'recent', 'en')
    expect(result[0].name).toBe('New')
    expect(result[1].name).toBe('Mid')
    expect(result[2].name).toBe('Old')
  })

  it('should fall back to originalIndex when timestamps are equal', () => {
    const items = [makeItem('B', 1000, 1), makeItem('A', 1000, 0)]
    const result = processRecentItems(items, '', 'recent', 'en')
    expect(result[0].name).toBe('A')
    expect(result[1].name).toBe('B')
  })
})

describe('groupRecentItems', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeItem = (name: string, lastOpenedAt: number, originalIndex = 0): RecentItemView => ({
    name,
    path: `/path/${name}.pdf`,
    lastOpenedAt,
    originalIndex,
    page: 1,
    totalPages: 100
  })

  it('should return single "all" group when no items have timestamps', () => {
    const items = [makeItem('A', 0), makeItem('B', 0)]
    const result = groupRecentItems(items)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('all')
    expect(result[0].labelKey).toBeNull()
  })

  it('should group today items correctly', () => {
    const now = Date.now()
    const items = [makeItem('Today', now)]
    const result = groupRecentItems(items)
    expect(result.find((g) => g.id === 'today')?.items.length).toBe(1)
  })

  it('should group week items correctly', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
    const items = [makeItem('Week', threeDaysAgo)]
    const result = groupRecentItems(items)
    expect(result.find((g) => g.id === 'week')?.items.length).toBe(1)
  })

  it('should group older items correctly', () => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const items = [makeItem('Old', twoWeeksAgo)]
    const result = groupRecentItems(items)
    expect(result.find((g) => g.id === 'older')?.items.length).toBe(1)
  })

  it('should filter out empty groups', () => {
    const now = Date.now()
    const items = [makeItem('Today', now)]
    const result = groupRecentItems(items)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('today')
  })

  it('should handle mixed time periods', () => {
    const now = Date.now()
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000
    const items = [
      makeItem('Today', now),
      makeItem('Week', threeDaysAgo),
      makeItem('Old', twoWeeksAgo)
    ]
    const result = groupRecentItems(items)
    expect(result.length).toBe(3)
  })
})
