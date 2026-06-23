import {
  PICKER_SCRIPTS,
  PICKER_TIMING,
  PICKER_TRANSLATION_KEYS
} from '@features/automation/lib/automationConstants'

import { describe, expect, it } from 'vitest'

describe('PICKER_TRANSLATION_KEYS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(PICKER_TRANSLATION_KEYS)).toBe(true)
    expect(PICKER_TRANSLATION_KEYS.length).toBeGreaterThan(0)
  })

  it('should contain step key', () => {
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_step')
  })

  it('should contain intro keys', () => {
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_intro_title')
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_intro_text')
  })

  it('should contain element keys', () => {
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_el_input')
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_el_submit')
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_el_button')
  })

  it('should contain hint keys', () => {
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_hint_input_correct')
    expect(PICKER_TRANSLATION_KEYS).toContain('picker_hint_submit_correct')
  })

  it('should contain all keys with picker_ prefix', () => {
    PICKER_TRANSLATION_KEYS.forEach((key) => {
      expect(key).toMatch(/^picker_/)
    })
  })

  it('should have no duplicate keys', () => {
    const unique = new Set(PICKER_TRANSLATION_KEYS)
    expect(unique.size).toBe(PICKER_TRANSLATION_KEYS.length)
  })
})

describe('PICKER_SCRIPTS', () => {
  it('should have RESET and CLEANUP as non-empty strings', () => {
    expect(typeof PICKER_SCRIPTS.RESET).toBe('string')
    expect(PICKER_SCRIPTS.RESET.length).toBeGreaterThan(0)
    expect(typeof PICKER_SCRIPTS.CLEANUP).toBe('string')
    expect(PICKER_SCRIPTS.CLEANUP.length).toBeGreaterThan(0)
  })

  it('should delete _aiPickerResult in RESET', () => {
    expect(PICKER_SCRIPTS.RESET).toContain('_aiPickerResult')
  })

  it('should delete _aiPickerCancelled in RESET', () => {
    expect(PICKER_SCRIPTS.RESET).toContain('_aiPickerCancelled')
  })

  it('should call cleanup function and delete globals in CLEANUP', () => {
    expect(PICKER_SCRIPTS.CLEANUP).toContain('_aiPickerCleanup')
    expect(PICKER_SCRIPTS.CLEANUP).toContain('_aiPickerResult')
    expect(PICKER_SCRIPTS.CLEANUP).toContain('_aiPickerCancelled')
  })
})

describe('PICKER_TIMING', () => {
  it('should expose positive numeric timings for every key', () => {
    expect(typeof PICKER_TIMING).toBe('object')
    for (const [key, value] of Object.entries(PICKER_TIMING)) {
      expect(typeof value, `${key} should be a number`).toBe('number')
      expect(value, `${key} should be > 0`).toBeGreaterThan(0)
    }
  })

  it('post-save delay should be longer than cleanup delay so the user sees the done state', () => {
    expect(PICKER_TIMING.POST_SAVE_DELAY_MS).toBeGreaterThanOrEqual(PICKER_TIMING.CLEANUP_DELAY_MS)
  })
})
