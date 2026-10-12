/**
 * Tests for src/shared/lib/uiUtils.ts — cn(), isValidHexColor(), hexToRgba().
 *
 * Pure utility functions used throughout the app for class merging and
 * color manipulation. If these break, dozens of components break too.
 */
import { cn, hexToRgba, isValidHexColor } from '@shared/lib/uiUtils'

import { describe, expect, it } from 'vitest'

describe('cn (className utility)', () => {
  it('joins simple class names with spaces', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, '', 'bar')).toBe('foo bar')
  })

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('merges conflicting tailwind classes (later wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles conditional classes', () => {
    const result = cn('base', true && 'active', false && 'hidden')
    expect(result).toContain('base')
    expect(result).toContain('active')
    expect(result).not.toContain('hidden')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  // The app's typography scale is `text-ql-*`. tailwind-merge did not know it,
  // so it treated `text-ql-12` and `text-muted-foreground` as rivals and kept
  // only the last one — silently, in both orders. That is how a `default`
  // Button ended up with `bg-primary` and no `text-primary-foreground`: white
  // text on a white button, in every theme.
  it('keeps a ql text size alongside a text color', () => {
    expect(cn('text-ql-12 text-muted-foreground')).toBe('text-ql-12 text-muted-foreground')
    expect(cn('text-primary-foreground text-ql-12')).toBe('text-primary-foreground text-ql-12')
    expect(cn('text-ql-11 text-destructive')).toBe('text-ql-11 text-destructive')
  })

  it('still resolves two text colors against each other', () => {
    expect(cn('text-ql-12 text-muted-foreground', 'text-foreground')).toBe(
      'text-ql-12 text-foreground'
    )
  })

  it('still resolves two ql text sizes against each other (later wins)', () => {
    expect(cn('text-ql-10', 'text-ql-14')).toBe('text-ql-14')
    // The scale overrides a variant size, which is what `size="sm"` supplies.
    expect(cn('text-xs text-ql-12')).toBe('text-ql-12')
  })
})

describe('isValidHexColor', () => {
  it('accepts 3-digit hex', () => {
    expect(isValidHexColor('#abc')).toBe(true)
    expect(isValidHexColor('#FFF')).toBe(true)
  })

  it('accepts 6-digit hex', () => {
    expect(isValidHexColor('#abcdef')).toBe(true)
    expect(isValidHexColor('#FFFFFF')).toBe(true)
  })

  it('rejects colors without #', () => {
    expect(isValidHexColor('abcdef')).toBe(false)
  })

  it('rejects invalid lengths', () => {
    expect(isValidHexColor('#abcd')).toBe(false)
    expect(isValidHexColor('#abcde')).toBe(false)
    expect(isValidHexColor('#abcdefg')).toBe(false)
    expect(isValidHexColor('#')).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(isValidHexColor('#xyzxyz')).toBe(false)
    expect(isValidHexColor('#abcdeg')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isValidHexColor('#aBcDeF')).toBe(true)
    expect(isValidHexColor('#ABC')).toBe(true)
  })
})

describe('hexToRgba', () => {
  it('converts 6-digit hex to rgba', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('converts 3-digit hex to 6-digit', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(hexToRgba('#000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)')
  })

  it('accepts hex without leading #', () => {
    expect(hexToRgba('ffffff', 1)).toBe('rgba(255, 255, 255, 1)')
  })

  it('returns default rgba(0, 0, 0, alpha) for empty input', () => {
    expect(hexToRgba('', 0.3)).toBe('rgba(0, 0, 0, 0.3)')
  })

  it('defaults alpha to 1', () => {
    expect(hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)')
  })
})
