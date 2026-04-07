import { describe, expect, it } from 'vitest'
import {
  getHealthLabelKey,
  getHealthTone
} from '../../../../features/settings/ui/selectors/selectorMappings'

describe('selectorMappings', () => {
  it('returns correct label keys for all health states', () => {
    expect(getHealthLabelKey('ready')).toBe('selectors_health_ready')
    expect(getHealthLabelKey('migrated')).toBe('selectors_health_migrated')
    expect(getHealthLabelKey('needs_repick')).toBe('selectors_health_needs_repick')
    expect(getHealthLabelKey('missing')).toBe('selectors_health_missing')
  })

  it('returns stable tone classes for health states', () => {
    const readyTone = getHealthTone('ready')
    expect(readyTone.badge).toContain('emerald')
    expect(readyTone.icon).toContain('emerald')
    expect(readyTone.border).toContain('emerald')

    const missingTone = getHealthTone('missing')
    expect(missingTone.badge).toContain('white')
    expect(missingTone.icon).toContain('white')
    expect(missingTone.border).toContain('white')
  })
})
