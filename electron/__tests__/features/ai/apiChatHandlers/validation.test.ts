import { describe, expect, it } from 'vitest'

import {
  isValidChatContentItem,
  MAX_MESSAGE_TEXT_LENGTH,
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

  it('rejects non-user roles', () => {
    expect(sanitizeChatMessage({ role: 'assistant', content: 'Hi' })).toBeNull()
    expect(sanitizeChatMessage({ role: 'system', content: 'Be helpful' })).toBeNull()
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

  it('handles undefined images gracefully', () => {
    const result = sanitizeChatMessage({ role: 'user', content: 'No images' })
    expect(result?.images).toBeUndefined()
  })

  it('handles empty images array', () => {
    const result = sanitizeChatMessage({ role: 'user', content: 'empty', images: [] })
    expect(result?.images).toEqual([])
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
