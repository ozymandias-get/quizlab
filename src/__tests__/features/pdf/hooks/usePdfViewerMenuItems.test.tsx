import { usePdfViewerMenuItems } from '@features/pdf/hooks/usePdfViewerMenuItems'

import { renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePdfViewerMenuItems', () => {
  const t = (key: string) => key
  const tt = (key: string) => key
  const handleAreaScreenshot = vi.fn()
  const extractCurrentPageText = vi.fn(() => 'page text')
  const handleFullPageScreenshot = vi.fn(async () => {})
  const setContextMenu = vi.fn()

  let reloadKey = 0
  const setViewerReloadKey = vi.fn((action: SetStateAction<number>) => {
    reloadKey = typeof action === 'function' ? action(reloadKey) : action
  })
  const startTransition = vi.fn((fn: () => void) => fn())

  const setup = () =>
    renderHook(() =>
      usePdfViewerMenuItems({
        t,
        tt,
        handleAreaScreenshot,
        extractCurrentPageTextRef: { current: extractCurrentPageText },
        handleFullPageScreenshotRef: { current: handleFullPageScreenshot },
        setContextMenu,
        setViewerReloadKey,
        startTransition
      })
    )

  beforeEach(() => {
    vi.clearAllMocks()
    reloadKey = 0
  })

  it('forwards text and image actions to their refs', () => {
    const { result } = setup()

    expect(result.current.handleAddCurrentPageTextToAi()).toBe('page text')
    expect(extractCurrentPageText).toHaveBeenCalledTimes(1)

    result.current.handleSendPageAsImageToAi()
    expect(handleFullPageScreenshot).toHaveBeenCalledTimes(1)
  })

  it('closes the context menu', () => {
    const { result } = setup()

    result.current.handleCloseContextMenu()

    expect(setContextMenu).toHaveBeenCalledWith(null)
  })

  // Zoom clamping and page jumps used to be `@react-pdf-viewer` adapters here.
  // The native controller owns its scale outright and exposes `jumpToPage`, so
  // the toolbar binds them directly and this hook no longer has a surface for
  // them — asserting the absence is what keeps a second clamp from reappearing.
  it('exposes no zoom or jump handler', () => {
    const { result } = setup()

    expect(result.current).not.toHaveProperty('handleZoom')
    expect(result.current).not.toHaveProperty('handleJumpToPage')
  })

  it('reloads the viewer by bumping the reload key inside a transition', () => {
    const { result } = setup()

    result.current.handleReload()

    expect(startTransition).toHaveBeenCalledTimes(1)
    expect(setViewerReloadKey).toHaveBeenCalledTimes(1)
    expect(reloadKey).toBe(1)
  })

  it('builds the context menu items wired to the same handlers', () => {
    const { result } = setup()
    const items = result.current.menuItems

    expect(items).toHaveLength(5)
    expect(items[0].label).toBe('pdf_add_current_page_text_to_ai')
    expect(items[1].label).toBe('pdf_send_page_as_image')
    expect(items[2].label).toBe('ctx_crop_screenshot_ai')
    expect(items[3].separator).toBe(true)
    expect(items[4].label).toBe('ctx_reload')
    expect(items[4].shortcut).toBe('Ctrl+R')
    expect(items[4].danger).toBe(true)

    items[0].onClick()
    items[1].onClick()
    items[2].onClick()
    items[4].onClick()

    expect(extractCurrentPageText).toHaveBeenCalledTimes(1)
    expect(handleFullPageScreenshot).toHaveBeenCalledTimes(1)
    expect(handleAreaScreenshot).toHaveBeenCalledTimes(1)
    expect(reloadKey).toBe(1)
  })
})
