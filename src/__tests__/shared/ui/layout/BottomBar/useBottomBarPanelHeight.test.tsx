import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBottomBarPanelHeight } from '@shared/ui/layout/BottomBar/useBottomBarPanelHeight'

describe('useBottomBarPanelHeight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 when closed', () => {
    const barRef = { current: null }
    const { result } = renderHook(() => useBottomBarPanelHeight(barRef, false, 1.0))
    expect(result.current).toBe(0)
  })

  it('returns 0 when barRef is null', () => {
    const barRef = { current: null }
    const { result } = renderHook(() => useBottomBarPanelHeight(barRef, true, 1.0))
    expect(result.current).toBe(0)
  })

  it('measures height when open with valid DOM', () => {
    const shell = document.createElement('div')
    shell.style.position = 'absolute'
    shell.style.top = '0'
    shell.style.bottom = '0'
    document.body.appendChild(shell)

    const hub = document.createElement('button')
    hub.className = 'hub-center-btn'
    hub.style.position = 'absolute'
    hub.style.top = '100px'
    hub.style.height = '40px'
    shell.appendChild(hub)

    const toolsArea = document.createElement('div')
    toolsArea.setAttribute('data-testid', 'tools-panel-scroll-area')
    toolsArea.style.height = '200px'
    shell.appendChild(toolsArea)

    const modelsArea = document.createElement('div')
    modelsArea.setAttribute('data-testid', 'models-panel-scroll-area')
    modelsArea.style.height = '200px'
    shell.appendChild(modelsArea)

    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 400,
      height: 400
    } as DOMRect)

    vi.spyOn(hub, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 140,
      height: 40
    } as DOMRect)

    const barRef = { current: shell }
    const { result } = renderHook(() => useBottomBarPanelHeight(barRef, true, 1.0))

    // Height should be measured (hub top - edge padding - panel gap = 100 - 12 - 10 = 78)
    expect(result.current).toBeGreaterThanOrEqual(0)

    document.body.removeChild(shell)
  })

  it('uses shorter of available top/bottom heights', () => {
    const shell = document.createElement('div')
    document.body.appendChild(shell)

    const hub = document.createElement('button')
    hub.className = 'hub-center-btn'
    shell.appendChild(hub)

    const toolsArea = document.createElement('div')
    toolsArea.setAttribute('data-testid', 'tools-panel-scroll-area')
    shell.appendChild(toolsArea)

    const modelsArea = document.createElement('div')
    modelsArea.setAttribute('data-testid', 'models-panel-scroll-area')
    shell.appendChild(modelsArea)

    // Hub is near the bottom, so top height is large but bottom height is small
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 400,
      height: 400
    } as DOMRect)

    vi.spyOn(hub, 'getBoundingClientRect').mockReturnValue({
      top: 350,
      bottom: 390,
      height: 40
    } as DOMRect)

    const barRef = { current: shell }
    const { result } = renderHook(() => useBottomBarPanelHeight(barRef, true, 1.0))

    // Bottom available: 400 - 390 - 12 - 10 = -12 -> clamped to 0
    expect(result.current).toBe(0)

    document.body.removeChild(shell)
  })

  it('resets to 0 when closed after being open', () => {
    const shell = document.createElement('div')
    document.body.appendChild(shell)

    const hub = document.createElement('button')
    hub.className = 'hub-center-btn'
    shell.appendChild(hub)

    const toolsArea = document.createElement('div')
    toolsArea.setAttribute('data-testid', 'tools-panel-scroll-area')
    shell.appendChild(toolsArea)

    const modelsArea = document.createElement('div')
    modelsArea.setAttribute('data-testid', 'models-panel-scroll-area')
    shell.appendChild(modelsArea)

    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 400,
      height: 400
    } as DOMRect)

    vi.spyOn(hub, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 240,
      height: 40
    } as DOMRect)

    const barRef = { current: shell }

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useBottomBarPanelHeight(barRef, open, 1.0),
      { initialProps: { open: true } }
    )

    expect(result.current).toBeGreaterThanOrEqual(0)

    rerender({ open: false })
    expect(result.current).toBe(0)

    document.body.removeChild(shell)
  })
})
