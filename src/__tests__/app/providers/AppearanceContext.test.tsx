import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppearance } from '@app/providers/AppearanceContext'

describe('AppearanceContext & Zustand Store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should initialize with correct default state values', () => {
    const { result } = renderHook(() => useAppearance())

    expect(result.current.showOnlyIcons).toBe(true)
    expect(result.current.bottomBarOpacity).toBe(0.7)
    expect(result.current.bottomBarScale).toBe(1.0)
    expect(result.current.bgType).toBe('solid')
    expect(result.current.bgSolidColor).toBe('#000000')
    expect(result.current.bgAnimatedColors).toEqual(['#140f0b', '#10100d', '#080808'])
    expect(result.current.bgRandomMode).toBe(false)
    expect(result.current.selectionColor).toBe('#EAB308')
    expect(result.current.isLayoutSwapped).toBe(false)
    expect(result.current.isTourActive).toBe(false)
    expect(result.current.performanceMode).toBe(false)
  })

  it('should successfully update state variables via action setters', () => {
    const { result } = renderHook(() => useAppearance())

    act(() => {
      result.current.setShowOnlyIcons(false)
      result.current.setBottomBarOpacity(0.9)
      result.current.setBottomBarScale(1.1)
      result.current.setBgType('animated')
      result.current.setBgSolidColor('#ffffff')
      result.current.setBgAnimatedColors(['#111', '#222'])
      result.current.setBgRandomMode(true)
      result.current.setSelectionColor('#ff0000')
      result.current.setIsLayoutSwapped(true)
      result.current.setIsTourActive(true)
      result.current.setPerformanceMode(true)
    })

    expect(result.current.showOnlyIcons).toBe(false)
    expect(result.current.bottomBarOpacity).toBe(0.9)
    expect(result.current.bottomBarScale).toBe(1.1)
    expect(result.current.bgType).toBe('animated')
    expect(result.current.bgSolidColor).toBe('#ffffff')
    expect(result.current.bgAnimatedColors).toEqual(['#111', '#222'])
    expect(result.current.bgRandomMode).toBe(true)
    expect(result.current.selectionColor).toBe('#ff0000')
    expect(result.current.isLayoutSwapped).toBe(true)
    expect(result.current.isTourActive).toBe(true)
    expect(result.current.performanceMode).toBe(true)
  })

  it('should toggle layout swapped correctly via toggleLayoutSwap', () => {
    const { result } = renderHook(() => useAppearance())

    act(() => {
      result.current.setIsLayoutSwapped(false)
    })
    expect(result.current.isLayoutSwapped).toBe(false)

    act(() => {
      result.current.toggleLayoutSwap()
    })
    expect(result.current.isLayoutSwapped).toBe(true)

    act(() => {
      result.current.toggleLayoutSwap()
    })
    expect(result.current.isLayoutSwapped).toBe(false)
  })

  it('should activate tour state when startTour is called', () => {
    const { result } = renderHook(() => useAppearance())

    act(() => {
      result.current.setIsTourActive(false)
    })
    expect(result.current.isTourActive).toBe(false)

    act(() => {
      result.current.startTour()
    })
    expect(result.current.isTourActive).toBe(true)
  })
})
