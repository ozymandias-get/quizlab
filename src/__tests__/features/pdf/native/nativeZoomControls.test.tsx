/**
 * The render-prop zoom controls the native path hands to the shared toolbar.
 *
 * The contract being pinned is that the native scale state reaches the *existing*
 * toolbar unchanged: no toolbar rewrite, no second set of buttons, and a
 * percentage readout that tracks the effective scale.
 */
import {
  createNativeZoomControls,
  useNativeZoomControls
} from '@features/pdf/native/nativeZoomControls'
import type {
  CurrentScaleComponent,
  ZoomComponent
} from '@features/pdf/ui/components/PdfZoomControls'

import { render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

interface CapturedChildProps {
  onClick?: () => void
  scale?: number
}

/** Render one control component and capture the props it passes to its render prop. */
function capture(Component: ZoomComponent | CurrentScaleComponent): CapturedChildProps {
  let captured: CapturedChildProps | null = null
  const children = ((childProps: CapturedChildProps) => {
    captured = childProps
    return <span />
  }) as never

  render(<Component children={children} />)

  if (!captured) throw new Error('render prop was never invoked')
  return captured
}

describe('createNativeZoomControls', () => {
  it('reports the effective scale to the current-scale readout', () => {
    const controls = createNativeZoomControls({
      scale: 1.67,
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })

    expect(capture(controls.CurrentScale)).toEqual({ scale: 1.67 })
  })

  it('routes the zoom-out button to the native zoom-out action', () => {
    const zoomOut = vi.fn()
    const controls = createNativeZoomControls({ scale: 1.2, zoomIn: vi.fn(), zoomOut })

    const child = capture(controls.ZoomOut)

    expect(child.onClick).toBe(zoomOut)
    expect(child.scale).toBe(1.2)
  })

  it('routes the zoom-in button to the native zoom-in action', () => {
    const zoomIn = vi.fn()
    const controls = createNativeZoomControls({ scale: 1.2, zoomIn, zoomOut: vi.fn() })

    const child = capture(controls.ZoomIn)

    expect(child.onClick).toBe(zoomIn)
    expect(child.scale).toBe(1.2)
  })
})

describe('useNativeZoomControls', () => {
  it('keeps the components stable across an unrelated re-render', () => {
    const zoomIn = vi.fn<() => void>()
    const zoomOut = vi.fn<() => void>()
    const { result, rerender } = renderHook(
      ({ scale }) => useNativeZoomControls({ scale, zoomIn, zoomOut }),
      { initialProps: { scale: 1.2 } }
    )
    const first = result.current

    rerender({ scale: 1.2 })

    expect(result.current.ZoomIn).toBe(first.ZoomIn)
    expect(result.current.ZoomOut).toBe(first.ZoomOut)
    expect(result.current.CurrentScale).toBe(first.CurrentScale)
  })

  it('rebuilds on a scale change so the memoised toolbar sees the new level', () => {
    // `PdfToolbar` and `PdfZoomControls` are both memoised. The zoom component
    // identities are the only signal that reaches the percentage readout, so
    // they have to change when the scale does.
    const { result, rerender } = renderHook(
      ({ scale }) =>
        useNativeZoomControls({ scale, zoomIn: vi.fn<() => void>(), zoomOut: vi.fn<() => void>() }),
      { initialProps: { scale: 1.2 } }
    )
    const first = result.current

    rerender({ scale: 1.4 })

    expect(result.current.CurrentScale).not.toBe(first.CurrentScale)
    expect(capture(result.current.CurrentScale)).toEqual({ scale: 1.4 })
  })
})
