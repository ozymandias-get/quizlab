import AppBackground from '@app/ui/AppBackground'

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockBgSolidColor = '#000000'

vi.mock('@app/providers', () => ({
  useAppearance: (selector?: (state: any) => any) => {
    const state = { bgSolidColor: mockBgSolidColor, bgMode: 'ambient' }
    return selector ? selector(state) : state
  }
}))

describe('AppBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBgSolidColor = '#000000'
  })

  it('derives the ambient gradient stops from the solid background colour', async () => {
    mockBgSolidColor = '#ff0000'
    const setPropertySpy = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty')

    render(<AppBackground />)

    await vi.waitFor(() => {
      expect(setPropertySpy).toHaveBeenCalledWith('--ambient-1', 'rgba(255, 0, 0, 0.22)')
      expect(setPropertySpy).toHaveBeenCalledWith('--ambient-3', 'rgba(255, 0, 0, 0.32)')
    })

    setPropertySpy.mockRestore()
  })
})
