import { normalizeConversationUrl } from '@features/ai/lib/conversationUrl'

import { describe, expect, it } from 'vitest'

describe('conversation URL identity', () => {
  it('rejects values that cannot identify a page', () => {
    expect(normalizeConversationUrl('not a url')).toBeNull()
    expect(normalizeConversationUrl('file:///tmp/chat')).toBeNull()
    expect(normalizeConversationUrl('javascript:alert(1)')).toBeNull()
  })

  it('drops the fragment and the default port', () => {
    expect(normalizeConversationUrl('https://CHATGPT.com:443/c/abc#message')).toBe(
      'https://chatgpt.com/c/abc'
    )
  })

  it.each([
    // These hosts permanently redirect to the canonical host, path preserved.
    ['https://chat.openai.com/c/abc', 'https://chatgpt.com/c/abc'],
    ['https://www.chatgpt.com/c/abc', 'https://chatgpt.com/c/abc'],
    ['https://www.claude.ai/chat/abc', 'https://claude.ai/chat/abc'],
    ['https://perplexity.ai/search/abc', 'https://www.perplexity.ai/search/abc'],
    ['https://youtube.com/watch?v=abc', 'https://www.youtube.com/watch?v=abc']
  ])('rewrites the verified alias %s', (raw, canonical) => {
    expect(normalizeConversationUrl(raw)).toBe(canonical)
  })

  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://www.perplexity.ai/search/abc',
    'https://example.com/Path'
  ])('leaves a canonical or unknown host alone: %s', (raw) => {
    expect(normalizeConversationUrl(raw)).toBe(raw)
  })

  it('keeps provider query parameters, which can carry conversation state', () => {
    expect(normalizeConversationUrl('https://chatgpt.com/c/abc?model=gpt-5')).toBe(
      'https://chatgpt.com/c/abc?model=gpt-5'
    )
    expect(normalizeConversationUrl('https://gemini.google.com/app/abc?authuser=0')).toBe(
      'https://gemini.google.com/app/abc?authuser=0'
    )
  })
})
