import { useAppearance } from '@shared/stores/appearanceStore'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('appearanceStore & Zustand Store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should initialize with correct default state values', () => {
    const { result } = renderHook(() => useAppearance())

    expect(result.current.bottomBarOpacity).toBe(0.7)
    expect(result.current.bottomBarScale).toBe(1.0)
    expect(result.current.bgSolidColor).toBe('#000000')
    expect(result.current.selectionColor).toBe('#EAB308')
    expect(result.current.isLayoutSwapped).toBe(false)
    expect(result.current.visibleModels).toEqual({})
    expect(result.current.visibleTools).toEqual({
      'tour-target-tool-settings': true,
      'tour-target-tool-swap': true,
      'tour-target-tool-pdf-focus': true,
      'tour-target-tool-ai-focus': true,
      'tour-target-tool-picker': true
    })
  })

  it('should successfully update state variables via action setters', () => {
    const { result } = renderHook(() => useAppearance())

    act(() => {
      result.current.setBottomBarOpacity(0.9)
      result.current.setBottomBarScale(1.1)
      result.current.setBgSolidColor('#ffffff')
      result.current.setSelectionColor('#ff0000')
      result.current.setIsLayoutSwapped(true)
    })

    expect(result.current.bottomBarOpacity).toBe(0.9)
    expect(result.current.bottomBarScale).toBe(1.1)
    expect(result.current.bgSolidColor).toBe('#ffffff')
    expect(result.current.selectionColor).toBe('#ff0000')
    expect(result.current.isLayoutSwapped).toBe(true)
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

  it('should update visible tools correctly', () => {
    const { result } = renderHook(() => useAppearance())

    act(() => {
      result.current.setVisibleTool('tour-target-tool-settings', false)
    })
    expect(result.current.visibleTools['tour-target-tool-settings']).toBe(false)

    act(() => {
      result.current.setVisibleTool('tour-target-tool-settings', true)
    })
    expect(result.current.visibleTools['tour-target-tool-settings']).toBe(true)
  })

  it('should toggle visible models correctly', () => {
    const { result } = renderHook(() => useAppearance())

    act(() => {
      result.current.setVisibleModel('chatgpt', false)
    })
    expect(result.current.visibleModels['chatgpt']).toBe(false)

    act(() => {
      result.current.setVisibleModel('chatgpt', true)
    })
    expect(result.current.visibleModels['chatgpt']).toBe(true)
  })
})
