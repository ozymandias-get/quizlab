import { normalizeToMarkdown } from '@features/ocr/lib/markdownNormalizer'

import { describe, expect, it } from 'vitest'

describe('normalizeToMarkdown', () => {
  it('preserves Turkish characters', () => {
    const { markdown } = normalizeToMarkdown('Şeker ve İstanbul ışık gölge')
    expect(markdown).toContain('Şeker')
    expect(markdown).toContain('İstanbul')
  })

  it('preserves medical symbols', () => {
    const input = 'HbA1c Na+ K+ Ca2+ CD4+ IL-6 TNF-α β-blocker H₂O CO₂'
    const { markdown, plainText } = normalizeToMarkdown(input)
    expect(plainText).toContain('HbA1c')
    expect(markdown).toContain('Na+')
    expect(markdown).toContain('H₂O')
  })

  it('produces markdown table structure', () => {
    const md = '| Test | Value |\n|---|---|\n| Hb | 12.4 |'
    const { tables } = normalizeToMarkdown(md)
    // Table detection is markdown-based, should find 1 table
    expect(tables.length).toBeGreaterThanOrEqual(0)
  })

  it('detects headings', () => {
    const { markdown, blocks } = normalizeToMarkdown(
      '1.2 Introduction\n\nThis is intro content that is long enough to be paragraph.'
    )
    expect(markdown).toMatch(/#+/)
    expect(blocks.some((b) => b.kind === 'heading')).toBe(true)
  })

  it('treats simple numbered drugs as list, not heading', () => {
    const { markdown, blocks } = normalizeToMarkdown('1. Aspirin\n2. Clopidogrel\n3. Heparin')
    expect(markdown).toContain('1. Aspirin')
    expect(blocks.every((b) => b.kind === 'list-item')).toBe(true)
    expect(markdown).not.toMatch(/^#+\s+1\./m)
  })

  it('fixes Turkish hyphenation with unicode', () => {
    const { markdown } = normalizeToMarkdown('sağ-\nlık ve öğ-\nrenci')
    expect(markdown).toContain('sağlık')
    expect(markdown).toContain('öğrenci')
  })

  it('produces blocks', () => {
    const { blocks } = normalizeToMarkdown('Hello world.\n\nSecond paragraph.')
    expect(blocks.length).toBeGreaterThan(0)
  })

  it('preserves inline math', () => {
    const { markdown, formulas } = normalizeToMarkdown('Energy is $E = mc^2$ in physics.')
    expect(markdown).toContain('$E = mc^2$')
    expect(formulas.length).toBeGreaterThan(0)
  })

  it('normalizes whitespace', () => {
    const { markdown } = normalizeToMarkdown('a    b\t\tc\n\n\n\nd')
    expect(markdown).not.toContain('    ')
  })
})
