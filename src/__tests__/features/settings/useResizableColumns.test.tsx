import { useResizableColumns } from '@features/settings/ui/modal/useResizableColumns'

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function setContainerWidth(
  result: { current: ReturnType<typeof useResizableColumns> },
  width: number
) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: width, configurable: true })
  result.current.containerRef.current = container
}

describe('useResizableColumns', () => {
  it('caps the sidebar so the settings content keeps usable width', () => {
    const { result } = renderHook(() => useResizableColumns())

    setContainerWidth(result, 600)

    act(() => {
      result.current.handleSidebarResize(1000)
    })

    // 600px of modal room minus the 340px the content needs.
    expect(result.current.sidebarWidth).toBe(260)
  })

  it('never grows beyond the absolute maximum on a wide window', () => {
    const { result } = renderHook(() => useResizableColumns())

    setContainerWidth(result, 1600)

    act(() => {
      result.current.handleSidebarResize(1000)
    })

    expect(result.current.sidebarWidth).toBe(380)
  })

  it('collapses to an icon rail when the content minimum no longer fits', () => {
    const { result } = renderHook(() => useResizableColumns())

    setContainerWidth(result, 400)

    act(() => {
      result.current.handleSidebarResize(1000)
    })

    // A 190px sidebar would leave less than the 340px the form needs.
    expect(result.current.isCompact).toBe(true)
    expect(result.current.sidebarWidth).toBe(56)
  })

  it('stays compact until the container clears the hysteresis margin', () => {
    const { result } = renderHook(() => useResizableColumns())

    setContainerWidth(result, 400)
    act(() => {
      result.current.handleSidebarResize(1000)
    })
    expect(result.current.isCompact).toBe(true)

    // Just above the entry threshold must not flip back immediately.
    setContainerWidth(result, 540)
    act(() => {
      result.current.handleSidebarResize(0)
    })
    expect(result.current.isCompact).toBe(true)
    expect(result.current.sidebarWidth).toBe(56)

    setContainerWidth(result, 560)
    act(() => {
      result.current.handleSidebarResize(0)
    })
    expect(result.current.isCompact).toBe(false)
  })
})
