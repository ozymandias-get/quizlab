import { describe, expect, it } from 'vitest'

import { sanitizeClipboardText } from '../../../core/systemHandlers/clipboard.js'

describe('sanitizeClipboardText', () => {
  it.each([
    ['CSI colour codes', '\x1b[31mred\x1b[0m', 'red'],
    ['NUL and unit-separator control characters', 'hello\x00world\x1Ftest', 'helloworldtest'],
    ['an OSC title-setting sequence', '\x1b]0;title\x1b\\text', 'text'],
    ['C0 controls excluding tab/newline/CR', '\x00\x01\x02text\x7F', 'text'],
    ['pastejacking with a hidden cursor-move command', 'ls\x1b[2D; rm -rf /', 'ls; rm -rf /']
  ])('strips %s', (_label, input, expected) => {
    expect(sanitizeClipboardText(input)).toBe(expected)
  })

  it('passes ordinary text and the empty string through untouched', () => {
    expect(sanitizeClipboardText('Hello, World! 123')).toBe('Hello, World! 123')
    expect(sanitizeClipboardText('')).toBe('')
  })
})
