import { describe, expect, it } from 'vitest'

import { sanitizeClipboardText } from '../../../core/systemHandlers/clipboard.js'

describe('sanitizeClipboardText', () => {
  it('strips ANSI escape sequences', () => {
    const result = sanitizeClipboardText('\x1b[31mred\x1b[0m')
    expect(result).toBe('red')
  })

  it('strips control characters', () => {
    const result = sanitizeClipboardText('hello\x00world\x1Ftest')
    expect(result).toBe('helloworldtest')
  })

  it('preserves normal text', () => {
    const result = sanitizeClipboardText('Hello, World! 123')
    expect(result).toBe('Hello, World! 123')
  })

  it('handles empty string', () => {
    expect(sanitizeClipboardText('')).toBe('')
  })

  it('strips OSC escape sequences', () => {
    const result = sanitizeClipboardText('\x1b]0;title\x1b\\text')
    expect(result).toBe('text')
  })

  it('strips C0 control characters excluding tab/newline/CR', () => {
    const result = sanitizeClipboardText('\x00\x01\x02text\x7F')
    expect(result).toBe('text')
  })

  it('handles pastejacking attempt with hidden commands', () => {
    const result = sanitizeClipboardText('ls\x1b[2D; rm -rf /')
    expect(result).toBe('ls; rm -rf /')
  })
})
