import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useAppAnimations } from '@app/hooks/useAppAnimations'

describe('useAppAnimations Hook', () => {
  it('should return default layout animation config when isLayoutSwapped is false or not provided', () => {
    const { result } = renderHook(() => useAppAnimations())

    const {
      leftPanelVariants,
      rightPanelVariants,
      resizerVariants,
      containerVariants,
      gpuAcceleratedStyle
    } = result.current

    expect(gpuAcceleratedStyle).toEqual({
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden'
    })

    expect(resizerVariants).toHaveProperty('visible')
    expect(resizerVariants).toHaveProperty('hidden')
    expect(containerVariants).toHaveProperty('visible')
    expect(containerVariants).toHaveProperty('hidden')

    // Standard leftPanel transitions left (-30 x coordinate for hidden state)
    expect(leftPanelVariants.hidden.x).toBe(-30)
    // Standard rightPanel transitions right (30 x coordinate for hidden state)
    expect(rightPanelVariants.hidden.x).toBe(30)
  })

  it('should swap left and right panel animation configs when isLayoutSwapped is true', () => {
    const { result } = renderHook(() => useAppAnimations(true))

    const { leftPanelVariants, rightPanelVariants } = result.current

    // Swapped leftPanel transitions right (30 x coordinate for hidden state)
    expect(leftPanelVariants.hidden.x).toBe(30)
    // Swapped rightPanel transitions left (-30 x coordinate for hidden state)
    expect(rightPanelVariants.hidden.x).toBe(-30)
  })
})
