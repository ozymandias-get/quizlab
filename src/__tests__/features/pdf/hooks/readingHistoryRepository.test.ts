import {
  MAX_RECENT_PDFS,
  parseReadingHistory,
  readReadingHistory,
  sanitizeReadingInfo,
  upsertRecentHistory,
  writeReadingHistory
} from '@features/pdf/hooks/readingHistoryRepository'

import { beforeEach, describe, expect, it } from 'vitest'

describe('sanitizeReadingInfo', () => {
  it('should return null for non-object input', () => {
    expect(sanitizeReadingInfo(null)).toBeNull()
    expect(sanitizeReadingInfo(undefined)).toBeNull()
    expect(sanitizeReadingInfo('string')).toBeNull()
    expect(sanitizeReadingInfo(42)).toBeNull()
  })

  it('should return null when path is missing', () => {
    expect(sanitizeReadingInfo({ name: 'test' })).toBeNull()
  })

  it('should return null when name is missing', () => {
    expect(sanitizeReadingInfo({ path: '/test.pdf' })).toBeNull()
  })

  it('should return sanitized info with defaults', () => {
    const result = sanitizeReadingInfo({ path: '/test.pdf', name: 'Test' })
    expect(result).toEqual({
      path: '/test.pdf',
      name: 'Test',
      page: 1,
      totalPages: 0
    })
  })

  it('should preserve valid lastOpenedAt', () => {
    const result = sanitizeReadingInfo({
      path: '/test.pdf',
      name: 'Test',
      lastOpenedAt: 1234567890
    })
    expect(result!.lastOpenedAt).toBe(1234567890)
  })

  it('should discard non-finite lastOpenedAt', () => {
    const result = sanitizeReadingInfo({
      path: '/test.pdf',
      name: 'Test',
      lastOpenedAt: NaN
    })
    expect(result!.lastOpenedAt).toBeUndefined()
  })

  it('should preserve page and totalPages', () => {
    const result = sanitizeReadingInfo({
      path: '/test.pdf',
      name: 'Test',
      page: 5,
      totalPages: 100
    })
    expect(result!.page).toBe(5)
    expect(result!.totalPages).toBe(100)
  })
})

describe('parseReadingHistory', () => {
  it('should return empty array for null input', () => {
    expect(parseReadingHistory(null)).toEqual([])
  })

  it('should parse valid JSON array', () => {
    const data = JSON.stringify([
      { path: '/a.pdf', name: 'A', page: 1, totalPages: 10 },
      { path: '/b.pdf', name: 'B', page: 5, totalPages: 20 }
    ])
    const result = parseReadingHistory(data)
    expect(result.length).toBe(2)
    expect(result[0].name).toBe('A')
  })

  it('should handle legacy single object format', () => {
    const data = JSON.stringify({ path: '/a.pdf', name: 'A' })
    const result = parseReadingHistory(data)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('A')
  })

  it('should filter out invalid entries', () => {
    const data = JSON.stringify([
      { path: '/a.pdf', name: 'A' },
      { invalid: true },
      { path: '/b.pdf', name: 'B' }
    ])
    const result = parseReadingHistory(data)
    expect(result.length).toBe(2)
  })

  it('should limit to MAX_RECENT_PDFS', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      path: `/file${i}.pdf`,
      name: `File ${i}`
    }))
    const data = JSON.stringify(items)
    const result = parseReadingHistory(data)
    expect(result.length).toBe(MAX_RECENT_PDFS)
  })

  it('should return empty array for invalid JSON', () => {
    const result = parseReadingHistory('not-json')
    expect(result).toEqual([])
  })
})

describe('upsertRecentHistory', () => {
  it('should add new item at the beginning', () => {
    const history = [{ path: '/a.pdf', name: 'A', page: 1, totalPages: 10 }]
    const newItem = { path: '/b.pdf', name: 'B', page: 1, totalPages: 10 }
    const result = upsertRecentHistory(history, newItem)
    expect(result[0].path).toBe('/b.pdf')
    expect(result.length).toBe(2)
  })

  it('should remove duplicate by path', () => {
    const history = [
      { path: '/a.pdf', name: 'A Old', page: 1, totalPages: 10 },
      { path: '/b.pdf', name: 'B', page: 1, totalPages: 10 }
    ]
    const updated = { path: '/a.pdf', name: 'A New', page: 5, totalPages: 10 }
    const result = upsertRecentHistory(history, updated)
    expect(result.length).toBe(2)
    expect(result[0].name).toBe('A New')
    expect(result.find((i) => i.name === 'A Old')).toBeUndefined()
  })

  it('should limit to MAX_RECENT_PDFS', () => {
    const history = Array.from({ length: MAX_RECENT_PDFS }, (_, i) => ({
      path: `/file${i}.pdf`,
      name: `File ${i}`,
      page: 1,
      totalPages: 10
    }))
    const newItem = { path: '/new.pdf', name: 'New', page: 1, totalPages: 10 }
    const result = upsertRecentHistory(history, newItem)
    expect(result.length).toBe(MAX_RECENT_PDFS)
    expect(result[0].path).toBe('/new.pdf')
  })
})

describe('readReadingHistory and writeReadingHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should write and read history', () => {
    const items = [
      { path: '/a.pdf', name: 'A', page: 1, totalPages: 10 },
      { path: '/b.pdf', name: 'B', page: 5, totalPages: 20 }
    ]
    writeReadingHistory(items)
    const result = readReadingHistory()
    expect(result.length).toBe(2)
    expect(result[0].name).toBe('A')
  })

  it('should remove key when writing empty array', () => {
    localStorage.setItem('lastPdfReading', 'old')
    writeReadingHistory([])
    expect(localStorage.getItem('lastPdfReading')).toBeNull()
  })

  it('should return empty array when nothing stored', () => {
    expect(readReadingHistory()).toEqual([])
  })
})
