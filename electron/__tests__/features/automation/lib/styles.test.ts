import { pickerStyles } from '@electron/features/automation/lib/styles'

import { describe, expect, it } from 'vitest'

describe('pickerStyles', () => {
  it('is a non-empty string', () => {
    expect(typeof pickerStyles).toBe('string')
    expect(pickerStyles.length).toBeGreaterThan(0)
  })

  it('contains the hover-good class', () => {
    expect(pickerStyles).toContain('._ai-picker-hover-good')
  })

  it('contains the hover-medium class', () => {
    expect(pickerStyles).toContain('._ai-picker-hover-medium')
  })

  it('contains the hover-low class', () => {
    expect(pickerStyles).toContain('._ai-picker-hover-low')
  })

  it('contains the selected class', () => {
    expect(pickerStyles).toContain('._ai-picker-selected')
  })

  it('contains !important rules', () => {
    expect(pickerStyles).toContain('!important')
  })

  it('includes outline-offset property', () => {
    expect(pickerStyles).toContain('outline-offset')
  })

  it('includes box-shadow property', () => {
    expect(pickerStyles).toContain('box-shadow')
  })

  it('has distinct color values for each variant', () => {
    expect(pickerStyles).toContain('#4ade80')
    expect(pickerStyles).toContain('#fbbf24')
    expect(pickerStyles).toContain('#f87171')
    expect(pickerStyles).toContain('#60a5fa')
  })
})
