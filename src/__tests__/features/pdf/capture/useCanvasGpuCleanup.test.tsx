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

    const wrapper = document.createElement('div')
    const canvas = makeCanvas()
    wrapper.appendChild(canvas)
    container.appendChild(wrapper)

    await act(async () => {
      wrapper.remove()
    })

    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
    unmount()
  })

  it('releases a directly removed canvas element', async () => {
    const { unmount } = renderHook(() => useCanvasGpuCleanup({ current: container }))

    const canvas = makeCanvas()
    container.appendChild(canvas)

    await act(async () => {
      canvas.remove()
    })

    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
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

  it('ignores removed nodes without canvases', () => {
    const { unmount } = renderHook(() => useCanvasGpuCleanup({ current: container }))

    const textNode = document.createElement('p')
    container.appendChild(textNode)
    act(() => {
      textNode.remove()
    })

    expect(textNode.isConnected).toBe(false)
    unmount()
  })
})
