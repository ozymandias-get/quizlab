import AppEffects from '@app/effects/AppEffects'

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('AppEffects legacy storage cleanup', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('removes leftover keys from removed features on mount', () => {
    window.localStorage.setItem('ocr-storage', JSON.stringify({ state: { config: {} } }))
    window.localStorage.setItem('useCustomPdfEngine', 'true')
    window.localStorage.setItem('unrelated-key', 'keep-me')

    render(<AppEffects />)

    expect(window.localStorage.getItem('ocr-storage')).toBeNull()
    expect(window.localStorage.getItem('useCustomPdfEngine')).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep-me')
  })

  it('cleans stale tutorial storage without touching user data', () => {
    window.localStorage.setItem('has_seen_tour_v1', 'true')
    window.localStorage.setItem(
      'tutorial-storage',
      JSON.stringify({ state: { completedTutorials: { general: true }, onboardingDone: true } })
    )
    window.localStorage.setItem('tutorial-completion', '{}')
    window.localStorage.setItem('tutorial-onboarding-done', 'true')
    window.localStorage.setItem('appLanguage', '"tr"')
    window.localStorage.setItem('appearance-storage', '{}')

    render(<AppEffects />)

    expect(window.localStorage.getItem('has_seen_tour_v1')).toBeNull()
    expect(window.localStorage.getItem('tutorial-storage')).toBeNull()
    expect(window.localStorage.getItem('tutorial-completion')).toBeNull()
    expect(window.localStorage.getItem('tutorial-onboarding-done')).toBeNull()
    expect(window.localStorage.getItem('appLanguage')).toBe('"tr"')
    expect(window.localStorage.getItem('appearance-storage')).toBe('{}')
  })
})
