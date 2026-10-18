import {
  releaseCanvasGpuMemory,
  useCanvasGpuCleanup
} from '@features/pdf/capture/useCanvasGpuCleanup'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function makeCanvas(width = 200, height = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

describe('releaseCanvasGpuMemory', () => {
  it('zeroes the canvas dimensions to free the GPU backing store', () => {
    const canvas = makeCanvas()
    releaseCanvasGpuMemory(canvas)
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })

  it('is a no-op for already-zeroed canvases', () => {
    const canvas = makeCanvas(0, 0)
    releaseCanvasGpuMemory(canvas)
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })
})

describe('useCanvasGpuCleanup', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('releases canvases removed from the container subtree', async () => {
    const { unmount } = renderHook(() => useCanvasGpuCleanup({ current: container }))

    // Both shapes at once: nested inside a wrapper, and a direct child.
    const wrapper = document.createElement('div')
    const nested = makeCanvas()
    wrapper.appendChild(nested)
    const direct = makeCanvas()
    container.append(wrapper, direct)

    await act(async () => {
      wrapper.remove()
      direct.remove()
    })

    expect(nested.width).toBe(0)
    expect(nested.height).toBe(0)
    expect(direct.width).toBe(0)
    expect(direct.height).toBe(0)
    unmount()
  })

  it('releases every canvas still attached on unmount', () => {
    const canvasA = makeCanvas()
    const canvasB = makeCanvas()
    container.appendChild(canvasA)
    container.appendChild(canvasB)

    const { unmount } = renderHook(() => useCanvasGpuCleanup({ current: container }))
    unmount()

    expect(canvasA.width).toBe(0)
    expect(canvasA.height).toBe(0)
    expect(canvasB.width).toBe(0)
    expect(canvasB.height).toBe(0)
  })

  it('does not disturb a live canvas when a canvas-free node is removed', () => {
    const { unmount } = renderHook(() => useCanvasGpuCleanup({ current: container }))

    // Text and layout nodes come and go constantly while a document renders. A
    // subtree scan must skip them without touching the canvases that are still
    // on screen — releasing a live one mid-capture blanks the page.
    const textNode = document.createElement('p')
    const canvas = makeCanvas()
    container.append(textNode, canvas)

    act(() => {
      textNode.remove()
    })

    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(100)
    unmount()
  })
})
