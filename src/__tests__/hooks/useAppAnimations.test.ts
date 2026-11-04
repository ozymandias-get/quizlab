import { useAppAnimations } from '@app/hooks/useAppAnimations'

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useAppAnimations', () => {
  it('returns the default config and swaps the panel sides when the layout is swapped', () => {
    const { result } = renderHook(() => useAppAnimations())

    const { leftPanelVariants, rightPanelVariants, resizerVariants, containerVariants } =
      result.current

    expect(resizerVariants).toHaveProperty('visible')
    expect(resizerVariants).toHaveProperty('hidden')
    expect(containerVariants).toHaveProperty('visible')
    expect(containerVariants).toHaveProperty('hidden')

    // Standard leftPanel transitions left (-30 x coordinate for hidden state)
    expect(leftPanelVariants.hidden.x).toBe(-30)
    // Standard rightPanel transitions right (30 x coordinate for hidden state)
    expect(rightPanelVariants.hidden.x).toBe(30)

    const swapped = renderHook(() => useAppAnimations(true)).result.current

    // Swapped leftPanel transitions right (30 x coordinate for hidden state)
    expect(swapped.leftPanelVariants.hidden.x).toBe(30)
    // Swapped rightPanel transitions left (-30 x coordinate for hidden state)
    expect(swapped.rightPanelVariants.hidden.x).toBe(-30)
  })
})
