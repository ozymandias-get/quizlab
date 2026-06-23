/**
 * Extended tests for normalizePdfText.
 */
import { normalizePdfText } from '@features/pdf/text/normalizePdfText'

import { describe, expect, it } from 'vitest'

describe('normalizePdfText', () => {
  describe('whitespace handling', () => {
    it('collapses multiple spaces to a single space', () => {
      expect(normalizePdfText('hello   world')).toBe('hello world')
      expect(normalizePdfText('a  b  c')).toBe('a b c')
    })

    it('collapses tabs to single space', () => {
      expect(normalizePdfText('a\t\t\tb')).toBe('a b')
    })

    it('collapses trailing whitespace on each line to a single space', () => {
      // Multi-space collapse happens first, so 3 trailing spaces become 1,
      // and the overall trim() then removes the trailing space on the last line.
      // Document the actual behavior.
      expect(normalizePdfText('line 1   \nline 2  ')).toBe('line 1 \nline 2')
    })

    it('removes leading whitespace from lines', () => {
      expect(normalizePdfText('  line 1\n  line 2')).toBe('line 1\nline 2')
    })

    it('trims overall result', () => {
      expect(normalizePdfText('   \n\n  hello  \n\n  ')).toBe('hello')
    })
  })

  describe('line break handling', () => {
    it('normalizes Windows line endings (\\r\\n) to \\n', () => {
      expect(normalizePdfText('line1\r\nline2')).toBe('line1\nline2')
    })

    it('normalizes Mac line endings (\\r) to \\n', () => {
      expect(normalizePdfText('line1\rline2')).toBe('line1\nline2')
    })

    it('collapses 3+ consecutive newlines to 2', () => {
      expect(normalizePdfText('a\n\n\n\nb')).toBe('a\n\nb')
    })

    it('preserves single newlines', () => {
      expect(normalizePdfText('a\nb\nc')).toBe('a\nb\nc')
    })

    it('preserves two consecutive newlines (paragraph break)', () => {
      expect(normalizePdfText('a\n\nb')).toBe('a\n\nb')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(normalizePdfText('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(normalizePdfText('   ')).toBe('')
      expect(normalizePdfText('\n\n\n')).toBe('')
    })

    it('handles mixed whitespace gracefully', () => {
      // 'a \t\n\r\n  b' -> 'a' (trailing space, no spaces/newlines, then 'b' with leading space)
      // The exact behavior: tabs collapse, leading spaces on newlines are stripped,
      // but trailing space on the first line remains.
      expect(normalizePdfText('a \t\n\r\n  b')).toBe('a \n\nb')
    })

    it('preserves internal punctuation', () => {
      expect(normalizePdfText('Hello, world! How are you?')).toBe('Hello, world! How are you?')
    })

    it('preserves Unicode characters', () => {
      expect(normalizePdfText('Merhaba  dünya  🌍')).toBe('Merhaba dünya 🌍')
    })
  })
})
