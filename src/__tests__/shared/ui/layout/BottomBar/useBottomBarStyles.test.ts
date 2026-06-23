import { useBottomBarStyles } from '@shared/ui/layout/BottomBar/useBottomBarStyles'

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useBottomBarStyles', () => {
  it('clamps opacity to min 0.1', () => {
    const { result } = renderHook(() => useBottomBarStyles(0, 1.0))
    const opacityFactor = (result.current.shellStyle as Record<string, unknown>)[
      '--bar-opacity-factor'
    ]
    expect(opacityFactor).toBe(0.1)
  })

  it('clamps opacity to max 1.0', () => {
    const { result } = renderHook(() => useBottomBarStyles(2.0, 1.0))
    const opacityFactor = (result.current.shellStyle as Record<string, unknown>)[
      '--bar-opacity-factor'
    ]
    expect(opacityFactor).toBe(1)
  })

  it('clamps scale to min 0.7', () => {
    const { result } = renderHook(() => useBottomBarStyles(0.5, 0.5))
    const scaleFactor = (result.current.shellStyle as Record<string, unknown>)['--bar-scale-factor']
    expect(scaleFactor).toBe(0.7)
  })

  it('clamps scale to max 1.3', () => {
    const { result } = renderHook(() => useBottomBarStyles(0.5, 2.0))
    const scaleFactor = (result.current.shellStyle as Record<string, unknown>)['--bar-scale-factor']
    expect(scaleFactor).toBe(1.3)
  })

  it('calculates scaled base size correctly', () => {
    const { result } = renderHook(() => useBottomBarStyles(0.7, 1.0))
    expect(result.current.shellStyle.width).toBe(48)
    expect(result.current.shellStyle.minWidth).toBe(48)
    expect(result.current.shellStyle.maxWidth).toBe(48)
  })

  it('scales base size with scale factor', () => {
    const { result } = renderHook(() => useBottomBarStyles(0.7, 1.2))
    // Width is always BASE_SIZE (48). The scale is applied to transform.
    expect(result.current.shellStyle.width).toBe(48)
  })

  it('returns shellStyle with CSS custom properties', () => {
    const { result } = renderHook(() => useBottomBarStyles(0.7, 1.0))
    expect(result.current.shellStyle).toHaveProperty('--bar-opacity-factor')
    expect(result.current.shellStyle).toHaveProperty('--bar-scale-factor')
    expect(result.current.shellStyle).toHaveProperty('width')
  })

  it('returns stackStyle with z-index and width', () => {
    const { result } = renderHook(() => useBottomBarStyles(0.7, 1.0))
    expect(result.current.stackStyle.zIndex).toBe(50)
    expect(result.current.stackStyle.width).toBe(48)
  })
})
