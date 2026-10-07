import { describe, expect, it } from 'vitest'

import {
  buildChatCompletionMessages,
  isValidChatContentItem,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_SINGLE_IMAGE_BYTES,
  sanitizeChatMessage
} from '../../../../features/ai/apiChatHandlers/validation.js'

describe('sanitizeChatMessage', () => {
  it('accepts valid user message with text content', () => {
    const result = sanitizeChatMessage({ role: 'user', content: 'Hello' })
    expect(result).toEqual({ role: 'user', content: 'Hello' })
  })

  it('rejects non-object messages', () => {
    expect(sanitizeChatMessage(null)).toBeNull()
    expect(sanitizeChatMessage(undefined)).toBeNull()
    expect(sanitizeChatMessage('string')).toBeNull()
    expect(sanitizeChatMessage(42)).toBeNull()
  })

  it('accepts assistant messages (multi-turn context) without images', () => {
    const result = sanitizeChatMessage({ role: 'assistant', content: 'Hi' })
    expect(result).toEqual({ role: 'assistant', content: 'Hi', images: undefined })
  })

  it('rejects non-chat roles such as system', () => {
    expect(sanitizeChatMessage({ role: 'system', content: 'Be helpful' })).toBeNull()
  })

  it('rejects assistant message with empty content', () => {
    expect(sanitizeChatMessage({ role: 'assistant', content: '' })).toBeNull()
  })

  it('truncates oversized assistant content and drops its images field', () => {
    const longContent = 'x'.repeat(MAX_MESSAGE_TEXT_LENGTH + 100)
    const result = sanitizeChatMessage({
      role: 'assistant',
      content: longContent,
      images: ['data:image/png,abc']
    })
    expect(result?.content.length).toBe(MAX_MESSAGE_TEXT_LENGTH)
    expect(result?.images).toBeUndefined()
  })

  it('truncates content exceeding MAX_MESSAGE_TEXT_LENGTH', () => {
    const longContent = 'x'.repeat(MAX_MESSAGE_TEXT_LENGTH + 100)
    const result = sanitizeChatMessage({ role: 'user', content: longContent })
    expect(result?.content.length).toBe(MAX_MESSAGE_TEXT_LENGTH)
  })

  it('returns null for empty content after truncation', () => {
    const result = sanitizeChatMessage({ role: 'user', content: '' })
    expect(result).toBeNull()
  })

  it('returns null for non-string content (e.g. ChatContentItem[])', () => {
    const result = sanitizeChatMessage({ role: 'user', content: [{ type: 'text', text: 'hi' }] })
    expect(result).toBeNull()
  })

  it('filters images array to only string values', () => {
    const msg = {
      role: 'user',
      content: 'Check this',
      images: ['data:image/png,abc123', 42, null, 'data:image/jpeg,def456']
    }
    const result = sanitizeChatMessage(msg)
    expect(result?.images).toEqual(['data:image/png,abc123', 'data:image/jpeg,def456'])
  })

  it('drops non-image and remote sources a provider could not dereference', () => {
    const result = sanitizeChatMessage({
      role: 'user',
      content: 'Check',
      images: [
        'https://example.com/a.png',
        'blob:http://localhost/abc',
        'file:///etc/passwd',
        'data:text/html,<script>',
        'javascript:alert(1)',
        'data:image/png;base64,OK'
      ]
    })
    expect(result?.images).toEqual(['data:image/png;base64,OK'])
  })

  it('accepts uncommon but valid image subtypes', () => {
    const result = sanitizeChatMessage({
      role: 'user',
      content: 'Check',
      images: ['data:image/heic;base64,AAAA', 'data:image/svg+xml;base64,BBBB']
    })
    expect(result?.images).toHaveLength(2)
  })
  it('handles undefined images gracefully', () => {
    const result = sanitizeChatMessage({ role: 'user', content: 'No images' })
    expect(result?.images).toBeUndefined()
  })

  it('handles empty images array', () => {
    const result = sanitizeChatMessage({ role: 'user', content: 'empty', images: [] })
    expect(result?.images).toEqual([])
  })
})

describe('sanitizeChatMessage — image-only turns', () => {
  // Regression: the attachment button, "Send page as image to AI" and the
  // screenshot crop all produce a turn with images and no typed text. Dropping
  // those turns here meant the image never reached the provider even though the
  // thumbnail was visible in the composer and the transcript.
  const PNG = 'data:image/png;base64,iVBORw0KGgo='

  it('keeps a user turn that has images but empty text', () => {
    const result = sanitizeChatMessage({ role: 'user', content: '', images: [PNG] })
    expect(result).toEqual({ role: 'user', content: '', images: [PNG] })
  })

  it('keeps a user turn whose content is whitespace only', () => {
    const result = sanitizeChatMessage({ role: 'user', content: '   \n ', images: [PNG] })
    expect(result).not.toBeNull()
    expect(result?.images).toEqual([PNG])
  })

  it('keeps a user turn with no content field at all but with images', () => {
    const result = sanitizeChatMessage({ role: 'user', images: [PNG] })
    expect(result).toEqual({ role: 'user', content: '', images: [PNG] })
  })

  it('still drops a user turn with empty text and no images', () => {
    expect(sanitizeChatMessage({ role: 'user', content: '', images: [] })).toBeNull()
    expect(sanitizeChatMessage({ role: 'user', content: '' })).toBeNull()
  })

  it('still drops an assistant turn with empty text', () => {
    expect(sanitizeChatMessage({ role: 'assistant', content: '' })).toBeNull()
  })

  it('does not rescue a turn whose only image was rejected', () => {
    expect(
      sanitizeChatMessage({ role: 'user', content: '', images: ['https://example.com/a.png'] })
    ).toBeNull()
  })
})

describe('sanitizeChatMessage — image source validation', () => {
  it('drops a single oversized image instead of failing the whole request', () => {
    const huge = `data:image/png;base64,${'A'.repeat(MAX_SINGLE_IMAGE_BYTES)}`
    const result = sanitizeChatMessage({
      role: 'user',
      content: 'Check',
      images: [huge, 'data:image/png;base64,SMALL']
    })
    expect(result?.images).toEqual(['data:image/png;base64,SMALL'])
  })

  it('keeps an image exactly at the single-image cap', () => {
    const prefix = 'data:image/png;base64,'
    const atCap = prefix + 'A'.repeat(MAX_SINGLE_IMAGE_BYTES - prefix.length)
    const result = sanitizeChatMessage({ role: 'user', content: 'x', images: [atCap] })
    expect(result?.images).toEqual([atCap])
  })
})

describe('buildChatCompletionMessages', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo='
  const JPEG = 'data:image/jpeg;base64,/9j/4AAQ'

  it('keeps a plain text turn as a bare string', () => {
    const messages = buildChatCompletionMessages([{ role: 'user', content: 'Hello' }])
    expect(messages).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('builds a text + image content array in that order', () => {
    const messages = buildChatCompletionMessages([
      { role: 'user', content: 'What is this?', images: [PNG, JPEG] }
    ])
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: PNG } },
          { type: 'image_url', image_url: { url: JPEG } }
        ]
      }
    ])
  })

  // Regression: an empty text part is rejected by Anthropic-compatible
  // gateways and Ollama, so image-only turns must not emit one.
  it('omits the text part for an image-only turn', () => {
    const messages = buildChatCompletionMessages([{ role: 'user', content: '', images: [PNG] }])
    expect(messages).toEqual([
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: PNG } }]
      }
    ])
  })

  it('omits the text part when the text is whitespace only', () => {
    const messages = buildChatCompletionMessages([
      { role: 'user', content: '  \n\t ', images: [PNG] }
    ])
    const content = messages[0].content
    expect(Array.isArray(content)).toBe(true)
    expect(content).toEqual([{ type: 'image_url', image_url: { url: PNG } }])
  })

  it('falls back to a bare string when the images array is empty', () => {
    const messages = buildChatCompletionMessages([{ role: 'user', content: 'Hi', images: [] }])
    expect(messages).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('never emits an empty content array', () => {
    const messages = buildChatCompletionMessages([{ role: 'user', content: '', images: [PNG] }])
    const content = messages[0].content
    expect(Array.isArray(content) && content.length).toBeGreaterThan(0)
  })

  it('preserves turn order across a multi-turn transcript', () => {
    const messages = buildChatCompletionMessages([
      { role: 'user', content: 'First question', images: [PNG] },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' }
    ])
    expect(messages).toHaveLength(3)
    expect(messages[1]).toEqual({ role: 'assistant', content: 'First answer' })
    expect(messages[2]).toEqual({ role: 'user', content: 'Second question' })
  })

  it('round-trips a sanitized image-only message into an image content array', () => {
    const sanitized = sanitizeChatMessage({ role: 'user', content: '', images: [PNG] })
    expect(sanitized).not.toBeNull()
    const messages = buildChatCompletionMessages([sanitized!])
    expect(messages[0].content).toEqual([{ type: 'image_url', image_url: { url: PNG } }])
  })
})

describe('isValidChatContentItem', () => {
  it('accepts valid text item', () => {
    expect(isValidChatContentItem({ type: 'text', text: 'hello' })).toBe(true)
  })

  it('accepts valid image_url item', () => {
    expect(
      isValidChatContentItem({
        type: 'image_url',
        image_url: { url: 'https://example.com/img.png' }
      })
    ).toBe(true)
  })

  it('rejects null and undefined', () => {
    expect(isValidChatContentItem(null)).toBe(false)
    expect(isValidChatContentItem(undefined)).toBe(false)
  })

  it('rejects non-object values', () => {
    expect(isValidChatContentItem('string')).toBe(false)
    expect(isValidChatContentItem(42)).toBe(false)
  })

  it('rejects text item without text field', () => {
    expect(isValidChatContentItem({ type: 'text' })).toBe(false)
  })

  it('rejects text item with non-string text', () => {
    expect(isValidChatContentItem({ type: 'text', text: 123 })).toBe(false)
  })

  it('rejects image_url item without image_url field', () => {
    expect(isValidChatContentItem({ type: 'image_url' })).toBe(false)
  })

  it('rejects image_url item with non-object image_url', () => {
    expect(isValidChatContentItem({ type: 'image_url', image_url: 'invalid' })).toBe(false)
  })

  it('rejects image_url item without url in image_url', () => {
    expect(isValidChatContentItem({ type: 'image_url', image_url: {} })).toBe(false)
  })

  it('rejects image_url item with non-string url', () => {
    expect(isValidChatContentItem({ type: 'image_url', image_url: { url: 123 } })).toBe(false)
  })

  it('rejects unknown item types', () => {
    expect(isValidChatContentItem({ type: 'unknown' })).toBe(false)
  })
})
