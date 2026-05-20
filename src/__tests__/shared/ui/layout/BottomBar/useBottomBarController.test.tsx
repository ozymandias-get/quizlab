import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBottomBarController } from '@shared/ui/layout/BottomBar/useBottomBarController'

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn() }
}))

describe('useBottomBarController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts closed', () => {
    const { result } = renderHook(() => useBottomBarController(false))
    expect(result.current.isOpen).toBe(false)
    expect(result.current.isSettingsOpen).toBe(false)
  })

  it('opens when tour is active', () => {
    const { result, rerender } = renderHook(
      ({ tourActive }: { tourActive: boolean }) => useBottomBarController(tourActive),
      { initialProps: { tourActive: false } }
    )

    expect(result.current.isOpen).toBe(false)

    rerender({ tourActive: true })
    expect(result.current.isOpen).toBe(true)
  })

  it('toggles open/close', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    act(() => {
      result.current.handleToggle()
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      vi.advanceTimersByTime(400)
    })
    act(() => {
      result.current.handleToggle()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('respects animation lock between toggles', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    act(() => {
      result.current.handleToggle()
    })
    expect(result.current.isOpen).toBe(true)

    // Animation lock prevents immediate re-toggle
    act(() => {
      result.current.handleToggle()
    })
    expect(result.current.isOpen).toBe(true)

    // After animation completes, toggle works
    act(() => {
      vi.advanceTimersByTime(400)
    })
    act(() => {
      result.current.handleToggle()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('opens settings with initial tab', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    act(() => {
      result.current.openSettings('appearance')
    })

    expect(result.current.isSettingsOpen).toBe(true)
    expect(result.current.settingsInitialTab).toBe('appearance')
  })

  it('closes settings', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    act(() => {
      result.current.openSettings('prompts')
    })
    expect(result.current.isSettingsOpen).toBe(true)

    act(() => {
      result.current.closeSettings()
    })
    expect(result.current.isSettingsOpen).toBe(false)
  })

  it('pointer up within threshold triggers toggle', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    const pointerDownEvent = { clientX: 100, clientY: 200 } as any
    const pointerUpEvent = { clientX: 102, clientY: 198 } as any

    act(() => {
      result.current.handleHubPointerDown(pointerDownEvent)
    })

    act(() => {
      result.current.handleHubPointerUp(pointerUpEvent)
    })

    expect(result.current.isOpen).toBe(true)
  })

  it('pointer up beyond threshold does not toggle', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    const pointerDownEvent = { clientX: 100, clientY: 200 } as any
    const pointerUpEvent = { clientX: 200, clientY: 300 } as any

    act(() => {
      result.current.handleHubPointerDown(pointerDownEvent)
    })

    act(() => {
      result.current.handleHubPointerUp(pointerUpEvent)
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('setIsOpen directly changes open state', () => {
    const { result } = renderHook(() => useBottomBarController(false))

    act(() => {
      result.current.setIsOpen(true)
    })
    expect(result.current.isOpen).toBe(true)
  })

  it('unmounts cleanly after toggle', () => {
    const { unmount, result } = renderHook(() => useBottomBarController(false))

    act(() => {
      result.current.handleToggle()
    })
    expect(result.current.isOpen).toBe(true)

    // Unmount - should not cause issues
    unmount()
  })
})
