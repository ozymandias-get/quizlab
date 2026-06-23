import { SUBMIT_MODE_OPTIONS } from '@features/settings/ui/selectors/constants'

import { describe, expect, it } from 'vitest'

describe('SUBMIT_MODE_OPTIONS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(SUBMIT_MODE_OPTIONS)).toBe(true)
    expect(SUBMIT_MODE_OPTIONS.length).toBeGreaterThan(0)
  })

  it('should have exactly 3 options', () => {
    expect(SUBMIT_MODE_OPTIONS.length).toBe(3)
  })

  it('should include mixed option', () => {
    const mixed = SUBMIT_MODE_OPTIONS.find((o) => o.value === 'mixed')
    expect(mixed).toBeDefined()
    expect(mixed!.labelKey).toBe('selectors_submit_mode_mixed')
  })

  it('should include click option', () => {
    const click = SUBMIT_MODE_OPTIONS.find((o) => o.value === 'click')
    expect(click).toBeDefined()
    expect(click!.labelKey).toBe('selectors_submit_mode_click')
  })

  it('should include enter_key option', () => {
    const enterKey = SUBMIT_MODE_OPTIONS.find((o) => o.value === 'enter_key')
    expect(enterKey).toBeDefined()
    expect(enterKey!.labelKey).toBe('selectors_submit_mode_enter_key')
  })

  it('should have all options with value and labelKey', () => {
    SUBMIT_MODE_OPTIONS.forEach((option) => {
      expect(option).toHaveProperty('value')
      expect(option).toHaveProperty('labelKey')
      expect(typeof option.value).toBe('string')
      expect(typeof option.labelKey).toBe('string')
    })
  })

  it('should have no duplicate values', () => {
    const values = SUBMIT_MODE_OPTIONS.map((o) => o.value)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})
