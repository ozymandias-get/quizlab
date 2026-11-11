import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import {
  MAX_RECENT_PDFS,
  readReadingHistory,
  upsertRecentHistory,
  writeReadingHistory
} from '@features/pdf/hooks/readingHistoryRepository'

import { beforeEach, describe, expect, it } from 'vitest'

function readRaw(stored: string | null) {
  if (stored === null) localStorage.removeItem(STORAGE_KEYS.LAST_PDF_READING)
  else localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, stored)
  return readReadingHistory()
}

function readValue(value: unknown) {
  return readRaw(JSON.stringify(value))
}

describe('readReadingHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('sanitization', () => {
    it('returns empty for missing or non-object values', () => {
      expect(readRaw(null)).toEqual([])
      expect(readValue(null)).toEqual([])
      expect(readValue('string')).toEqual([])
      expect(readValue(42)).toEqual([])
    })

    it('drops entries missing path or name', () => {
      expect(readValue([{ name: 'test' }, { path: '/test.pdf' }])).toEqual([])
    })

    it('fills defaults for a valid entry', () => {
      expect(readValue({ path: '/test.pdf', name: 'Test' })).toEqual([
        {
          path: '/test.pdf',
          name: 'Test',
          page: 1,
          totalPages: 0
        }
      ])
    })

    it('preserves a valid lastOpenedAt', () => {
      const result = readValue({ path: '/test.pdf', name: 'Test', lastOpenedAt: 1234567890 })
      expect(result[0].lastOpenedAt).toBe(1234567890)
    })

    it('discards a non-finite lastOpenedAt', () => {
      const result = readValue({ path: '/test.pdf', name: 'Test', lastOpenedAt: NaN })
      expect(result[0].lastOpenedAt).toBeUndefined()
    })

    it('preserves page and totalPages', () => {
      const result = readValue({ path: '/test.pdf', name: 'Test', page: 5, totalPages: 100 })
      expect(result[0].page).toBe(5)
      expect(result[0].totalPages).toBe(100)
    })

    it('replaces an invalid page and totalPages', () => {
      const result = readValue({ path: '/test.pdf', name: 'Test', page: -4, totalPages: 2.5 })
      expect(result[0].page).toBe(1)
      expect(result[0].totalPages).toBe(0)
    })
  })

  describe('parsing', () => {
    it('parses a valid JSON array', () => {
      const result = readRaw(
        JSON.stringify([
          { path: '/a.pdf', name: 'A', page: 1, totalPages: 10 },
          { path: '/b.pdf', name: 'B', page: 5, totalPages: 20 }
        ])
      )
      expect(result.length).toBe(2)
      expect(result[0].name).toBe('A')
    })

    it('handles the legacy single-object format', () => {
      const result = readValue({ path: '/a.pdf', name: 'A' })
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('A')
    })

    it('filters out invalid entries', () => {
      const result = readValue([
        { path: '/a.pdf', name: 'A' },
        { invalid: true },
        { path: '/b.pdf', name: 'B' }
      ])
      expect(result.length).toBe(2)
    })

    it('limits to MAX_RECENT_PDFS', () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        path: `/file${i}.pdf`,
        name: `File ${i}`
      }))
      expect(readValue(items).length).toBe(MAX_RECENT_PDFS)
    })

    it('returns empty for invalid JSON', () => {
      expect(readRaw('not-json')).toEqual([])
    })
  })

  describe('writing', () => {
    it('round-trips history through storage', () => {
      const items = [
        { path: '/a.pdf', name: 'A', page: 1, totalPages: 10 },
        { path: '/b.pdf', name: 'B', page: 5, totalPages: 20 }
      ]
      writeReadingHistory(items)
      const result = readReadingHistory()
      expect(result.length).toBe(2)
      expect(result[0].name).toBe('A')
    })

    it('removes the key when writing an empty array', () => {
      localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, 'old')
      writeReadingHistory([])
      expect(localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)).toBeNull()
    })

    it('returns empty when nothing is stored', () => {
      expect(readReadingHistory()).toEqual([])
    })
  })
})

describe('upsertRecentHistory', () => {
  it('adds a new item at the beginning', () => {
    const history = [{ path: '/a.pdf', name: 'A', page: 1, totalPages: 10 }]
    const newItem = { path: '/b.pdf', name: 'B', page: 1, totalPages: 10 }
    const result = upsertRecentHistory(history, newItem)
    expect(result[0].path).toBe('/b.pdf')
    expect(result.length).toBe(2)
  })

  it('removes a duplicate by path', () => {
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

  it('limits to MAX_RECENT_PDFS', () => {
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

  it('treats Windows path case and separators as the same history entry', () => {
    const history = upsertRecentHistory([], {
      path: 'C:\\Docs\\A.pdf',
      name: 'A.pdf',
      page: 1,
      totalPages: 10
    })

    const next = upsertRecentHistory(history, {
      path: 'c:/docs/a.pdf',
      name: 'A.pdf',
      page: 4,
      totalPages: 10
    })

    expect(next).toHaveLength(1)
    expect(next[0].page).toBe(4)
  })
})
