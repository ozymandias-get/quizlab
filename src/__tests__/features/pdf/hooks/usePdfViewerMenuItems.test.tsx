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
  const contextMenuPointRef: { current: { x: number; y: number } | null } = { current: null }

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
        contextMenuPointRef,
        setViewerReloadKey,
        startTransition
      })
    )

  beforeEach(() => {
    vi.clearAllMocks()
    reloadKey = 0
    contextMenuPointRef.current = null
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

  // Not asserted on purpose: `handleZoom` / `handleJumpToPage`. Those were
  // `@react-pdf-viewer` adapters; the viewer is gone and the native controller
  // owns scale and page jumps outright, so neither name appears anywhere in
  // `src/` any more. A `not.toHaveProperty` guard on a name that exists nowhere
  // can only fail if someone re-typed the exact same identifier.

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

  /**
   * Sağ tık noktası, iki AI öğesinden de aşağı taşınmalı.
   *
   * Nokta taşınmazsa karar menüsü (AI'ye Gönder | Taslağa Ekle) nereye
   * konumlanacağını bilemez ve sayfanın son metin satırına — yani tıklamayla
   * ilgisi olmayan bir yere — düşer.
   */
  it('forwards the right-click point to both AI actions', () => {
    contextMenuPointRef.current = { x: 420, y: 260 }
    const { result } = setup()

    result.current.menuItems[0].onClick()
    expect(extractCurrentPageText).toHaveBeenCalledWith({ x: 420, y: 260 })

    result.current.menuItems[1].onClick()
    expect(handleFullPageScreenshot).toHaveBeenCalledWith({ x: 420, y: 260 })
  })

  it('calls both actions with no point when nothing was right-clicked', () => {
    const { result } = setup()

    result.current.menuItems[0].onClick()
    result.current.menuItems[1].onClick()

    expect(extractCurrentPageText).toHaveBeenCalledWith(undefined)
    expect(handleFullPageScreenshot).toHaveBeenCalledWith(undefined)
  })
})
