import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBottomBarStyles } from '@shared/ui/layout/BottomBar/useBottomBarStyles'

describe('useBottomBarStyles', () => {
  it('clamps opacity to min 0.1', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0, 1.0))
    const opacityFactor = (result.current.shellStyle as Record<string, unknown>)[
      '--bar-opacity-factor'
    ]
    expect(opacityFactor).toBe(0.1)
  })

  it('clamps opacity to max 1.0', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 2.0, 1.0))
    const opacityFactor = (result.current.shellStyle as Record<string, unknown>)[
      '--bar-opacity-factor'
    ]
    expect(opacityFactor).toBe(1)
  })

  it('clamps scale to min 0.7', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.5, 0.5))
    const scaleFactor = (result.current.shellStyle as Record<string, unknown>)['--bar-scale-factor']
    expect(scaleFactor).toBe(0.7)
  })

  it('clamps scale to max 1.3', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.5, 2.0))
    const scaleFactor = (result.current.shellStyle as Record<string, unknown>)['--bar-scale-factor']
    expect(scaleFactor).toBe(1.3)
  })

  it('calculates scaled base size correctly', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.0))
    expect(result.current.shellStyle.width).toBe(48)
    expect(result.current.shellStyle.minWidth).toBe(48)
    expect(result.current.shellStyle.maxWidth).toBe(48)
  })

  it('scales base size with scale factor', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.2))
    const expected = Math.round(48 * 1.2)
    expect(result.current.shellStyle.width).toBe(expected)
  })

  it('returns shellStyle with CSS custom properties', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.0))
    expect(result.current.shellStyle).toHaveProperty('--bar-opacity-factor')
    expect(result.current.shellStyle).toHaveProperty('--bar-scale-factor')
    expect(result.current.shellStyle).toHaveProperty('width')
  })

  it('returns stackStyle with z-index and width', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.0))
    expect(result.current.stackStyle.zIndex).toBe(50)
    expect(result.current.stackStyle.width).toBe(48)
  })

  it('returns panelStyle with backdropFilter', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.0))
    expect(result.current.panelStyle.backdropFilter).toBe('blur(16px) saturate(118%)')
    expect(result.current.panelStyle).toHaveProperty('borderRadius')
  })

  it('returns hubStyle with open/closed background based on isOpen', () => {
    const { result: openResult } = renderHook(() => useBottomBarStyles(true, 0.7, 1.0))
    const { result: closedResult } = renderHook(() => useBottomBarStyles(false, 0.7, 1.0))

    expect(openResult.current.hubStyle.background).toContain('hub-open-bg')
    expect(closedResult.current.hubStyle.background).toContain('hub-closed-bg')
  })

  it('hubStyle has cursor pointer', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.0))
    expect(result.current.hubStyle.cursor).toBe('pointer')
  })

  it('hubStyle borderRadius scales with clampedScale', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.2))
    const expected = Math.max(12, Math.round(16 * 1.2))
    expect(result.current.hubStyle.borderRadius).toBe(expected)
  })

  it('panelStyle borderRadius scales with clampedScale', () => {
    const { result } = renderHook(() => useBottomBarStyles(false, 0.7, 1.2))
    const expected = Math.max(10, Math.round(14 * 1.2))
    expect(result.current.panelStyle.borderRadius).toBe(expected)
  })
})
