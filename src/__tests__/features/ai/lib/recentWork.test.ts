import {
  createRecentAiWorkEntry,
  isValidLastUsedAt,
  readRecentAiWork,
  recordRecentAiWork,
  RECENT_AI_WORK_LIMIT,
  removeRecentAiWork,
  replaceRecentAiWork,
  sanitizeRecentAiWork,
  upsertRecentAiWork
} from '@features/ai/lib/recentWork'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import { beforeEach, describe, expect, it } from 'vitest'

function entry(modelId: string, url: string, lastUsedAt = 1) {
  const created = createRecentAiWorkEntry(modelId, url, lastUsedAt)
  if (!created) throw new Error('expected a valid entry')
  return created
}

describe('recent AI work', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEYS.RECENT_AI_WORK)
  })

  it('rejects URLs that cannot identify an AI conversation', () => {
    expect(createRecentAiWorkEntry('chatgpt', 'not a url')).toBeNull()
    expect(createRecentAiWorkEntry('chatgpt', 'file:///etc/passwd')).toBeNull()
    expect(createRecentAiWorkEntry('', 'https://chatgpt.com/c/1')).toBeNull()
  })

  it('drops the fragment and normalizes the URL for identity', () => {
    const created = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/abc#message')
    expect(created?.url).toBe('https://chatgpt.com/c/abc')
    expect(created?.id).toBe('chatgpt::https://chatgpt.com/c/abc')
  })

  it('carries the PDF name and keeps it when a later send has no file', () => {
    const first = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/abc',
      10,
      '  Biyoloji   Notları.pdf  '
    )
    expect(first?.documentName).toBe('Biyoloji Notları.pdf')

    const withoutFile = entry('chatgpt', 'https://chatgpt.com/c/abc', 20)
    if (!first) throw new Error('first entry expected')
    const result = upsertRecentAiWork([first], withoutFile)

    expect(result[0].documentName).toBe('Biyoloji Notları.pdf')
  })

  it('sanitizes a stored PDF name', () => {
    const [stored] = sanitizeRecentAiWork([
      {
        modelId: 'chatgpt',
        url: 'https://chatgpt.com/c/abc',
        documentName: `  ${'x'.repeat(400)}  `,
        lastUsedAt: 1
      }
    ])

    expect(stored.documentName?.length).toBeLessThanOrEqual(180)
    expect(stored.documentName?.endsWith('…')).toBe(true)
  })

  it('moves a repeated conversation to the top instead of duplicating it', () => {
    const older = entry('chatgpt', 'https://chatgpt.com/c/1', 10)
    const newer = entry('claude', 'https://claude.ai/chat/2', 20)
    const returned = entry('chatgpt', 'https://chatgpt.com/c/1', 30)

    const result = upsertRecentAiWork([newer, older], returned)

    expect(result.map((item) => item.id)).toEqual([returned.id, newer.id])
  })

  it('collapses chats used with the same document into the newest one', () => {
    const older = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/old',
      10,
      '10.Şok Patofizyolojisi Çeşitleri Tedavisi.pdf'
    )
    const newer = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/new',
      20,
      '10.Şok Patofizyolojisi Çeşitleri Tedavisi.pdf'
    )
    if (!older || !newer) throw new Error('entries expected')

    const result = upsertRecentAiWork([older], newer)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(newer.id)
    expect(result[0].documentName).toBe('10.Şok Patofizyolojisi Çeşitleri Tedavisi.pdf')
  })

  it('keeps the same document under different sites as separate cards', () => {
    const chatgpt = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/1', 10, 'Fizik.pdf')
    const claude = createRecentAiWorkEntry('claude', 'https://claude.ai/chat/2', 20, 'Fizik.pdf')
    if (!chatgpt || !claude) throw new Error('entries expected')

    const result = upsertRecentAiWork([chatgpt], claude)

    expect(result.map((item) => item.id)).toEqual([claude.id, chatgpt.id])
  })

  it('does not collapse chats that were not used with a document', () => {
    const first = entry('chatgpt', 'https://chatgpt.com/c/1', 10)
    const second = entry('chatgpt', 'https://chatgpt.com/c/2', 20)

    expect(upsertRecentAiWork([first], second).map((item) => item.id)).toEqual([
      second.id,
      first.id
    ])
    expect(sanitizeRecentAiWork([first, second])).toHaveLength(2)
  })

  it('collapses document duplicates that are already in storage', () => {
    const result = sanitizeRecentAiWork([
      {
        modelId: 'chatgpt',
        url: 'https://chatgpt.com/c/old',
        documentName: 'Fizik.pdf',
        lastUsedAt: 10
      },
      {
        modelId: 'chatgpt',
        url: 'https://chatgpt.com/c/new',
        documentName: 'Fizik.pdf',
        lastUsedAt: 30
      },
      {
        modelId: 'chatgpt',
        url: 'https://chatgpt.com/c/mid',
        documentName: 'Fizik.pdf',
        lastUsedAt: 20
      },
      {
        modelId: 'claude',
        url: 'https://claude.ai/chat/1',
        documentName: 'Fizik.pdf',
        lastUsedAt: 5
      }
    ])

    expect(result.map((item) => item.url)).toEqual([
      'https://chatgpt.com/c/new',
      'https://claude.ai/chat/1'
    ])
  })

  it('removes every chat behind a collapsed card', () => {
    const older = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/1', 10, 'Fizik.pdf')
    const newer = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/2', 20, 'Fizik.pdf')
    if (!older || !newer) throw new Error('entries expected')
    recordRecentAiWork(older)
    recordRecentAiWork(newer)
    expect(readRecentAiWork()).toHaveLength(1)

    removeRecentAiWork(newer.id)

    expect(readRecentAiWork()).toEqual([])
  })

  it(`keeps at most ${RECENT_AI_WORK_LIMIT} conversations`, () => {
    const entries = Array.from({ length: RECENT_AI_WORK_LIMIT }, (_, index) =>
      entry('chatgpt', `https://chatgpt.com/c/${index}`, index)
    )

    const result = upsertRecentAiWork(entries, entry('chatgpt', 'https://chatgpt.com/c/latest', 99))

    expect(result).toHaveLength(RECENT_AI_WORK_LIMIT)
    expect(result[0].url).toBe('https://chatgpt.com/c/latest')
    expect(result.some((item) => item.url.endsWith('/9'))).toBe(false)
  })

  it('sanitizes malformed storage rows and orders the rest by recency', () => {
    const result = sanitizeRecentAiWork([
      { modelId: 'chatgpt', url: 'https://chatgpt.com/c/old', lastUsedAt: 1 },
      { modelId: 'chatgpt', url: 'not a url', lastUsedAt: 2 },
      { modelId: 42, url: 'https://chatgpt.com/c/bad', lastUsedAt: 3 },
      { modelId: 'claude', url: 'https://claude.ai/chat/new', lastUsedAt: 30 },
      null
    ])

    expect(result.map((item) => item.modelId)).toEqual(['claude', 'chatgpt'])
    expect(result[1].lastUsedAt).toBe(1)
  })

  it('records, reads and removes entries through storage', () => {
    const first = entry('chatgpt', 'https://chatgpt.com/c/1')
    const second = entry('claude', 'https://claude.ai/chat/2')

    recordRecentAiWork(first)
    recordRecentAiWork(second)

    expect(readRecentAiWork().map((item) => item.id)).toEqual([second.id, first.id])

    removeRecentAiWork(second.id)
    expect(readRecentAiWork().map((item) => item.id)).toEqual([first.id])
  })

  it('swaps a provisional landing-page entry for the real conversation', () => {
    const landing = entry('chatgpt', 'https://chatgpt.com/')
    const conversation = entry('chatgpt', 'https://chatgpt.com/c/actual')
    recordRecentAiWork(landing)

    replaceRecentAiWork(landing, conversation)

    const stored = readRecentAiWork()
    expect(stored.map((item) => item.id)).toEqual([conversation.id])
  })

  it('treats a legacy provider host as the same conversation', () => {
    const legacy = entry('chatgpt', 'https://chat.openai.com/c/abc', 10)
    const canonical = entry('chatgpt', 'https://chatgpt.com/c/abc', 20)

    expect(legacy.id).toBe(canonical.id)
    expect(upsertRecentAiWork([legacy], canonical)).toHaveLength(1)
  })

  it('shows the most recent PDF when one chat was used with two documents', () => {
    const first = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/abc',
      10,
      'Biyoloji.pdf'
    )
    const second = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/abc', 20, 'Fizik.pdf')
    if (!first || !second) throw new Error('entries expected')

    const [stored] = upsertRecentAiWork([first], second)

    expect(stored.documentName).toBe('Fizik.pdf')
  })

  it('keeps the PDF of an existing conversation when a swap lands on it', () => {
    const existing = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/actual',
      10,
      'Biyoloji.pdf'
    )
    const landing = entry('chatgpt', 'https://chatgpt.com/', 20)
    if (!existing) throw new Error('entry expected')
    recordRecentAiWork(existing)
    recordRecentAiWork(landing)

    const next = entry('chatgpt', 'https://chatgpt.com/c/actual', 30)
    replaceRecentAiWork(landing, next)

    const stored = readRecentAiWork()
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(next.id)
    expect(stored[0].documentName).toBe('Biyoloji.pdf')
  })

  it('keeps the other conversations when a provisional entry is replaced', () => {
    const other = entry('claude', 'https://claude.ai/chat/2', 5)
    const landing = entry('chatgpt', 'https://chatgpt.com/', 10)
    recordRecentAiWork(other)
    recordRecentAiWork(landing)

    const conversation = entry('chatgpt', 'https://chatgpt.com/c/actual', 20)
    replaceRecentAiWork(landing, conversation)

    expect(readRecentAiWork().map((item) => item.id)).toEqual([conversation.id, other.id])
  })

  it('keeps both conversations when two new chats share a landing page', () => {
    const landing = entry('chatgpt', 'https://chatgpt.com/', 10)
    recordRecentAiWork(landing)
    // The second send reuses the same landing URL, so it overwrites the row.
    recordRecentAiWork({ ...landing, lastUsedAt: 11 })

    const first = entry('chatgpt', 'https://chatgpt.com/c/a', 20)
    const second = entry('chatgpt', 'https://chatgpt.com/c/b', 21)
    replaceRecentAiWork(landing, first)
    replaceRecentAiWork(landing, second)

    expect(readRecentAiWork().map((item) => item.id)).toEqual([second.id, first.id])
  })

  it('does not lose a conversation when two sites resolve in sequence', () => {
    const landingA = entry('chatgpt', 'https://chatgpt.com/', 10)
    const landingB = entry('claude', 'https://claude.ai/', 11)
    recordRecentAiWork(landingA)
    recordRecentAiWork(landingB)

    const finalA = entry('chatgpt', 'https://chatgpt.com/c/a', 12)
    const finalB = entry('claude', 'https://claude.ai/chat/b', 13)
    replaceRecentAiWork(landingA, finalA)
    replaceRecentAiWork(landingB, finalB)

    expect(readRecentAiWork().map((item) => item.id)).toEqual([finalB.id, finalA.id])
  })

  it('replaces a timestamp that no date formatter could render', () => {
    const [stored] = sanitizeRecentAiWork([
      { modelId: 'chatgpt', url: 'https://chatgpt.com/c/abc', lastUsedAt: Number.MAX_VALUE }
    ])

    expect(isValidLastUsedAt(stored.lastUsedAt)).toBe(true)
    expect(() =>
      new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(stored.lastUsedAt))
    ).not.toThrow()
  })
})
