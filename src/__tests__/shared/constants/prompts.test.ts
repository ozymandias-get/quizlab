import { DEFAULT_PROMPTS } from '@shared/constants/prompts'

import { describe, expect, it } from 'vitest'

describe('DEFAULT_PROMPTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_PROMPTS)).toBe(true)
    expect(DEFAULT_PROMPTS.length).toBeGreaterThan(0)
  })

  it('each prompt has id and text', () => {
    for (const prompt of DEFAULT_PROMPTS) {
      expect(prompt).toHaveProperty('id')
      expect(prompt).toHaveProperty('text')
      expect(typeof prompt.id).toBe('string')
      expect(typeof prompt.text).toBe('string')
    }
  })

  it('has unique ids', () => {
    const ids = DEFAULT_PROMPTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes TR and EN variants for each category', () => {
    const ids = DEFAULT_PROMPTS.map((p) => p.id)
    expect(ids.some((id) => id.endsWith('_tr'))).toBe(true)
    expect(ids.some((id) => id.endsWith('_en'))).toBe(true)
  })

  it('edu_explain_simple_tr is first (most commonly used)', () => {
    expect(DEFAULT_PROMPTS[0].id).toBe('edu_explain_simple_tr')
  })
})
