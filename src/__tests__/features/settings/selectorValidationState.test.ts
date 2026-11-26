import type { AiSelectorConfig } from '@shared-core/types'

import {
  getSelectorConfigSignature,
  isValidationCurrent
} from '@features/settings/ui/selectors/selectorUtils'

import { describe, expect, it } from 'vitest'

const baseConfig: AiSelectorConfig = {
  input: '#prompt',
  button: '#send',
  inputCandidates: ['#prompt'],
  buttonCandidates: ['#send'],
  inputFingerprint: { tag: 'textarea' },
  buttonFingerprint: { tag: 'button' },
  submitMode: 'mixed'
}

describe('selector validation staleness', () => {
  it('produces the same signature for an equal config object', () => {
    expect(getSelectorConfigSignature({ ...baseConfig })).toBe(
      getSelectorConfigSignature(baseConfig)
    )
  })

  it('drops a test result once the saved selectors changed underneath it', () => {
    const validation = {
      status: 'success' as const,
      configSignature: getSelectorConfigSignature(baseConfig)
    }

    expect(isValidationCurrent(validation, baseConfig)).toBe(true)
    expect(isValidationCurrent(validation, { ...baseConfig, input: '#other' })).toBe(false)
    expect(isValidationCurrent(validation, { ...baseConfig, button: null })).toBe(false)
    // A reset removes the config entirely: an old success must not survive.
    expect(isValidationCurrent(validation, null)).toBe(false)
  })

  it('keeps states that were not produced by a test run', () => {
    expect(isValidationCurrent({ status: 'idle' }, baseConfig)).toBe(true)
    // Open-tab timeout / parked-test errors carry no signature.
    expect(isValidationCurrent({ status: 'error', error: 'timeout' }, baseConfig)).toBe(true)
  })
})
