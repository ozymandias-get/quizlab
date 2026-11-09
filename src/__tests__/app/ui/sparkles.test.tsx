/**
 * A paused sparkle renderer must stop *scheduling* frames, not just skip drawing.
 * That is the difference between an idle canvas and a callback running on every
 * animation frame for as long as the window stays open.
 */
import SparklesCore from '@app/components/ui/sparkles'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Pending frames, keyed the way a browser keys them so cancel can remove one. */
let frames: Map<number, FrameRequestCallback>
let nextFrameId: number
let cancelAnimationFrame: ReturnType<typeof vi.fn>

function pendingFrames(): number {
  return frames.size
}

/** Run every frame scheduled so far, as the browser would at the next paint. */
function flushFrames(): void {
  const callbacks = [...frames.values()]
  frames.clear()
  act(() => {
    for (const callback of callbacks) callback(0)
  })
}

describe('SparklesCore animation loop', () => {
  beforeEach(() => {
    frames = new Map()
    nextFrameId = 1
    cancelAnimationFrame = vi.fn((id: number) => {
      frames.delete(id)
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      }
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalAlpha: 1
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      width: 100,
      height: 50,
      toJSON: () => ({})
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('schedules no frame at all while mounted paused', () => {
    render(<SparklesCore paused />)

    expect(pendingFrames()).toBe(0)
  })

  it('stops scheduling on pause and restarts on resume', () => {
    const { rerender } = render(<SparklesCore />)

    expect(pendingFrames()).toBe(1)
    flushFrames()
    // A running loop keeps exactly one frame in flight.
    expect(pendingFrames()).toBe(1)

    rerender(<SparklesCore paused />)

    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(pendingFrames()).toBe(0)

    rerender(<SparklesCore paused={false} />)

    expect(pendingFrames()).toBe(1)
  })

  it('stops when the document becomes hidden and resumes when it is visible again', () => {
    let hidden = false
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden
    })

    try {
      render(<SparklesCore />)
      expect(pendingFrames()).toBe(1)

      hidden = true
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(pendingFrames()).toBe(0)
      flushFrames()
      expect(pendingFrames()).toBe(0)

      hidden = false
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(pendingFrames()).toBe(1)
    } finally {
      delete (document as unknown as Record<string, unknown>).hidden
      if (descriptor) Object.defineProperty(Document.prototype, 'hidden', descriptor)
    }
  })
})
