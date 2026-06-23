/**
 * Sanity tests for the test factory helpers.
 * The factory functions themselves are the foundation for many tests —
 * if they don't behave correctly, downstream assertions become unreliable.
 */
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  daysAgo,
  makeChatMessage,
  makeChatMessages,
  makeConversation,
  makeLastReading,
  makeLastReadingList,
  makePdfFile,
  makePdfFiles,
  makePdfTab,
  makeProviderConfig,
  makeProviderList,
  minutesAgo,
  resetFactoryCounters,
  seedLocalStorage
} from './factories'

const testTempDir = tmpdir()

describe('factories: resetFactoryCounters', () => {
  beforeEach(() => {
    resetFactoryCounters()
  })

  it('returns to zero after reset', () => {
    makePdfFile()
    makePdfFile()
    resetFactoryCounters()
    const file = makePdfFile()
    expect(file.name).toBe('document-1.pdf')
  })
})

describe('factories: makePdfFile', () => {
  beforeEach(() => resetFactoryCounters())

  it('returns a complete default object', () => {
    const file = makePdfFile()
    expect(file.name).toBe('document-1.pdf')
    expect(file.path).toBe(join(testTempDir, 'document-1.pdf'))
    expect(file.streamUrl).toBe('blob:stream-1')
    expect(file.size).toBe(1024)
  })

  it('respects overrides', () => {
    const file = makePdfFile({ name: 'custom.pdf', size: 9999 })
    expect(file.name).toBe('custom.pdf')
    expect(file.size).toBe(9999)
  })

  it('produces unique files on each call', () => {
    const a = makePdfFile()
    const b = makePdfFile()
    expect(a.name).not.toBe(b.name)
    expect(a.path).not.toBe(b.path)
  })

  it('makePdfFiles returns the requested count', () => {
    const list = makePdfFiles(5)
    expect(list).toHaveLength(5)
  })
})

describe('factories: makeChatMessage', () => {
  beforeEach(() => resetFactoryCounters())

  it('defaults to user role', () => {
    const msg = makeChatMessage()
    expect(msg.role).toBe('user')
    expect(msg.content).toContain('Message')
    expect(typeof msg.timestamp).toBe('number')
  })

  it('respects role override', () => {
    const msg = makeChatMessage({ role: 'assistant', content: 'reply' })
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('reply')
  })

  it('produces unique ids', () => {
    const a = makeChatMessage()
    const b = makeChatMessage()
    expect(a.id).not.toBe(b.id)
  })

  it('makeChatMessages returns the requested count', () => {
    expect(makeChatMessages(3)).toHaveLength(3)
  })
})

describe('factories: makeConversation', () => {
  beforeEach(() => resetFactoryCounters())

  it('alternates user/assistant', () => {
    const conv = makeConversation(2)
    expect(conv).toHaveLength(4)
    expect(conv[0].role).toBe('user')
    expect(conv[1].role).toBe('assistant')
    expect(conv[2].role).toBe('user')
    expect(conv[3].role).toBe('assistant')
  })

  it('returns empty array for 0 rounds', () => {
    expect(makeConversation(0)).toEqual([])
  })
})

describe('factories: makeProviderConfig', () => {
  beforeEach(() => resetFactoryCounters())

  it('returns a valid openai-style provider', () => {
    const provider = makeProviderConfig()
    expect(provider.providerType).toBe('openai')
    expect(provider.enabled).toBe(true)
    expect(Array.isArray(provider.models)).toBe(true)
    expect(provider.models.length).toBeGreaterThan(0)
  })

  it('respects provider type override', () => {
    const provider = makeProviderConfig({ providerType: 'anthropic' })
    expect(provider.providerType).toBe('anthropic')
  })

  it('makeProviderList returns multiple distinct providers', () => {
    const list = makeProviderList()
    expect(list.length).toBeGreaterThanOrEqual(3)
    const ids = new Set(list.map((p) => p.id))
    expect(ids.size).toBe(list.length)
  })
})

describe('factories: makeLastReading', () => {
  beforeEach(() => resetFactoryCounters())

  it('returns a default valid entry', () => {
    const item = makeLastReading()
    expect(item.name).toContain('history-')
    expect(item.path).toContain(testTempDir)
    expect(typeof item.page).toBe('number')
    expect(typeof item.totalPages).toBe('number')
  })

  it('makeLastReadingList returns ordered items', () => {
    const list = makeLastReadingList(3)
    expect(list).toHaveLength(3)
    // newest first
    expect(list[0].lastOpenedAt ?? 0).toBeGreaterThanOrEqual(list[1].lastOpenedAt ?? 0)
  })
})

describe('factories: makePdfTab', () => {
  beforeEach(() => resetFactoryCounters())

  it('returns a complete tab', () => {
    const tab = makePdfTab()
    expect(tab.id).toContain('tab-')
    expect(tab.kind).toBe('pdf')
    expect(tab.file).not.toBeNull()
  })

  it('respects overrides for kind=drive', () => {
    const tab = makePdfTab({ kind: 'drive', file: null, webviewUrl: 'https://example.com' })
    expect(tab.kind).toBe('drive')
    expect(tab.file).toBeNull()
    expect(tab.webviewUrl).toBe('https://example.com')
  })
})

describe('factories: time helpers', () => {
  beforeEach(() => {
    resetFactoryCounters()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('minutesAgo subtracts from current time', () => {
    const now = Date.now()
    expect(minutesAgo(5)).toBe(now - 5 * 60_000)
  })

  it('daysAgo subtracts from current time', () => {
    const now = Date.now()
    expect(daysAgo(2)).toBe(now - 2 * 24 * 60 * 60_000)
  })
})

describe('factories: seedLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('seeds entries and restores previous values on cleanup', () => {
    localStorage.setItem('existing', 'previous')

    const restore = seedLocalStorage({ existing: 'new', fresh: 'fresh-value' })
    expect(localStorage.getItem('existing')).toBe('new')
    expect(localStorage.getItem('fresh')).toBe('fresh-value')

    restore()
    expect(localStorage.getItem('existing')).toBe('previous')
    expect(localStorage.getItem('fresh')).toBeNull()
  })
})
