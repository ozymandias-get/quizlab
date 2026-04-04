import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePdfScreenshot } from '@features/pdf/ui/hooks/usePdfScreenshot'

describe('usePdfScreenshot', () => {
  const queueImageForAi = vi.fn()
  const startScreenshot = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: () => 'data:image/png;base64,mockScreenshotData'
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('captures the current page layer canvas using 1-based data-page-number', async () => {
    const page12Layer = document.createElement('div')
    page12Layer.className = 'rpv-core__page-layer'
    page12Layer.setAttribute('data-page-number', '12')
    const page12Canvas = document.createElement('canvas')
    Object.defineProperty(page12Canvas, 'width', { configurable: true, value: 400 })
    Object.defineProperty(page12Canvas, 'height', { configurable: true, value: 200 })
    page12Layer.appendChild(page12Canvas)

    const page13Layer = document.createElement('div')
    page13Layer.className = 'rpv-core__page-layer'
    page13Layer.setAttribute('data-page-number', '13')
    const page13Canvas = document.createElement('canvas')
    Object.defineProperty(page13Canvas, 'width', { configurable: true, value: 420 })
    Object.defineProperty(page13Canvas, 'height', { configurable: true, value: 210 })
    page13Layer.appendChild(page13Canvas)

    document.body.appendChild(page12Layer)
    document.body.appendChild(page13Layer)

    const { result } = renderHook(() =>
      usePdfScreenshot({
        currentPage: 13,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).toHaveBeenCalledTimes(1)
    expect(queueImageForAi).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
      {
        page: 13,
        captureKind: 'full-page'
      }
    )
  })
})
