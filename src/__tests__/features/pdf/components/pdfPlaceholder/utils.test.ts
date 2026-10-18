import type { RecentItemView } from '@features/pdf/ui/components/pdfPlaceholder/types'
import {
  formatRelativeTime,
  getProgressRatio,
  groupRecentItems,
  processRecentItems
} from '@features/pdf/ui/components/pdfPlaceholder/pdfPlaceholderUtils'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('getProgressRatio', () => {
  // Every one of these is the same guard: a total that cannot produce a
  // meaningful fraction must fall back to the 8% minimum rather than NaN,
  // Infinity or 0. One table, one assertion.
  it.each([
    ['a zero page count', 5, 0],
    ['a negative page count', 5, -1],
    ['a NaN page count', 5, NaN],
    ['a page far below the total', 1, 1000],
    ['page 0', 0, 100]
  ])('clamps to the 0.08 minimum for %s', (_label, page, totalPages) => {
    expect(getProgressRatio(page, totalPages)).toBe(0.08)
  })

  it('returns 1 for page equal to totalPages', () => {
    expect(getProgressRatio(100, 100)).toBe(1)
  })

  it('returns the smaller axis ratio at the midpoint', () => {
    expect(getProgressRatio(50, 100)).toBe(0.5)
  })

  it('clamps a ratio above 1 to 1', () => {
    expect(getProgressRatio(150, 100)).toBe(1)
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Two dimensions, one table: the magnitude picks the bucket, the locale picks
  // the word. Both halves matter, so both are pinned here rather than in two
  // near-identical Turkish/English suites.
  it.each([
    ['5 minutes', 5 * 60_000, 'tr', 'dakika'],
    ['3 hours', 3 * 60 * 60_000, 'en', 'hour'],
    ['2 days', 2 * 24 * 60 * 60_000, 'tr', 'gün'],
    ['2 weeks', 14 * 24 * 60 * 60_000, 'en', 'week']
  ])('formats %s ago', (_label, elapsed, language, expected) => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))

    expect(formatRelativeTime(Date.now() - elapsed, language)).toContain(expected)
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

  // The bucket comes from the item's age; each row also pins that the empty
  // groups are dropped rather than rendered as headers with nothing under them.
  it.each([
    ['today', 0, 'today'],
    ['this week', 3 * 24 * 60 * 60_000, 'week'],
    ['older', 14 * 24 * 60 * 60_000, 'older']
  ])('groups an item from %s under %s and nothing else', (_label, age, groupId) => {
    const items = [makeItem('Item', Date.now() - age)]
    const result = groupRecentItems(items)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(groupId)
    expect(result[0].items).toHaveLength(1)
  })

  it('splits mixed ages into one group each', () => {
    const now = Date.now()
    const items = [
      makeItem('Today', now),
      makeItem('Week', now - 3 * 24 * 60 * 60_000),
      makeItem('Old', now - 14 * 24 * 60 * 60_000)
    ]

    const result = groupRecentItems(items)

    expect(result.map((g) => g.id)).toEqual(['today', 'week', 'older'])
    expect(result.flatMap((g) => g.items)).toHaveLength(3)
  })
})
