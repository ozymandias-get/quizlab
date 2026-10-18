import type { SelectorHealthState } from '@features/settings/ui/selectors/types'

import { describe, expect, it } from 'vitest'

import {
  getHealthLabelKey,
  getHealthTone
} from '../../../../features/settings/ui/selectors/selectorMappings'

const ALL_STATES: SelectorHealthState[] = [
  'ready',
  'migrated',
  'repaired',
  'needs_repick',
  'missing'
]

describe('selectorMappings', () => {
  // Every state a card can land in must map to a distinct, non-empty label key —
  // a missing key renders a blank badge on the selector card.
  it('gives every health state its own label key', () => {
    const keys = ALL_STATES.map((state) => getHealthLabelKey(state))

    for (const key of keys) {
      expect(key).toMatch(/^selectors_health_/)
    }
    expect(new Set(keys).size).toBe(keys.length)
  })

  // Only the distinction matters, not the exact Tailwind classes: a design-token
  // change should not fail a behaviour test.
  it('renders each health state differently from the healthy one', () => {
    const ready = getHealthTone('ready')

    for (const state of ALL_STATES.filter((value) => value !== 'ready')) {
      const tone = getHealthTone(state)
      expect(tone.badge, `${state} badge should differ from ready`).not.toBe(ready.badge)
      expect(tone.border, `${state} border should differ from ready`).not.toBe(ready.border)
    }
  })
})
