import {
  createRecentAiWorkEntry,
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
})
