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

  /**
   * Losslessness guard.
   *
   * normalizePdfText output is fed into AI prompts, so it may only change
   * whitespace, ligatures and Unicode composition. It must never substitute one
   * printable character for another: the U+02C6/U+00B8/U+02DC -> ö/ü/ğ repair it
   * used to perform had no fixture, no issue and no test behind it, fired on any
   * page containing ö/ü/ç, and rewrote characters that are legitimate in French,
   * Catalan, Sami and Turkic transliteration.
   */
  describe('character-level losslessness', () => {
    it('leaves ordinary Turkish text untouched', () => {
      const input = 'Öğrenciler için öğretim üç yıl sürdü; güğüm çözdü.'
      expect(normalizePdfText(input)).toBe(input)
      expect(normalizePdfText('İstanbul Üniversitesi Şubesi')).toBe('İstanbul Üniversitesi Şubesi')
      expect(normalizePdfText('ışık ilıklı')).toBe('ışık ilıklı')
    })

    it('does not rewrite the cedilla, circumflex accent or small tilde', () => {
      // Each is a real character elsewhere, so without corruption evidence they
      // have to survive verbatim.
      expect(normalizePdfText('François ¸ façon')).toBe('François ¸ façon')
      expect(normalizePdfText('mañana ˆ佳能')).toBe('mañana ˆ佳能')
      expect(normalizePdfText('Turkic ˜ ˜g')).toBe('Turkic ˜ ˜g')
      expect(normalizePdfText('Prices: 5¸90 CHF')).toBe('Prices: 5¸90 CHF')
    })

    it('does not rewrite those characters even inside otherwise Turkish text', () => {
      // The old guard matched ö/ü themselves, so a stray cedilla anywhere in a
      // page containing an umlaut was rewritten. Every artifact must survive.
      const input = 'Bir öğrenci ¸ okˆ du˘ var'
      expect(normalizePdfText(input)).toBe(input)
    })

    it('keeps every other printable character as-is', () => {
      const input = 'a¨b´c`d"e\'f–g—h…i€j£k¥l©m®n±o×p÷qµr¼s½t¾u¿v'
      expect(normalizePdfText(input)).toBe(input)
    })

    it('expands typographic ligatures losslessly', () => {
      expect(normalizePdfText('efﬁcient')).toBe('efficient')
      expect(normalizePdfText('ﬁzyoloji')).toBe('fizyoloji')
      expect(normalizePdfText('ﬂow')).toBe('flow')
      expect(normalizePdfText('oﬃce')).toBe('office')
      expect(normalizePdfText('buﬀet')).toBe('buffet')
      // U+FB05 LATIN SMALL LIGATURE LONG S T (a real ligature, not U+017F long s).
      expect(normalizePdfText('pa\uFB05')).toBe('past')
      expect(normalizePdfText('pa\uFB06')).toBe('past')
      // A bare long s is not a ligature and must survive untouched.
      expect(normalizePdfText('pa\u017Ft')).toBe('paſt')
    })

    it('composes decomposed characters without altering them', () => {
      // NFD "o" + combining diaeresis must compose to ö, and NFD "u" + combining
      // diaeresis to ü — composition, not substitution.
      expect(normalizePdfText('o\u0308')).toBe('ö')
      expect(normalizePdfText('u\u0308')).toBe('ü')
      expect(normalizePdfText('g\u0306')).toBe('ğ')
      expect(normalizePdfText('i\u0307')).toBe('i̇')
      // A decomposed sequence the old map could mangle is still composed.
      expect(normalizePdfText('¸\u0308')).toBe('¸̈')
    })

    it('still normalizes whitespace around text it leaves unchanged', () => {
      expect(normalizePdfText('  François ¸  façon  ')).toBe('François ¸ façon')
    })
  })
})
