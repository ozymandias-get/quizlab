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
})
