import { PDF_ZOOM_MAX_SCALE } from '@features/pdf/constants/pdfZoom'

import { Crop, Image as ImageIcon, RefreshCw, Type } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useMemo } from 'react'

import type { MenuItem } from '../ui/components/ContextMenu'

interface MenuItemsInput {
  t: (key: string) => string
  tt: (key: string) => string
  handleAreaScreenshot: () => void
  extractCurrentPageTextRef: React.MutableRefObject<() => string | null>
  handleFullPageScreenshotRef: React.MutableRefObject<() => Promise<void>>
  jumpToPageFromNav: (page: number) => void
  setContextMenu: (menu: { x: number; y: number } | null) => void
  setScaleFactor: Dispatch<SetStateAction<number>>
  setViewerReloadKey: Dispatch<SetStateAction<number>>
  startTransition: (fn: () => void) => void
}

interface MenuItemsOutput {
  handleAddCurrentPageTextToAi: () => void
  handleSendPageAsImageToAi: () => void
  handleReload: () => void
  handleZoom: (e: { scale: number }) => void
  handleJumpToPage: (page: number) => void
  handleCloseContextMenu: () => void
  menuItems: MenuItem[]
}

export function usePdfViewerMenuItems(input: MenuItemsInput): MenuItemsOutput {
  const {
    t,
    tt,
    handleAreaScreenshot,
    extractCurrentPageTextRef,
    handleFullPageScreenshotRef,
    jumpToPageFromNav,
    setContextMenu,
    setScaleFactor,
    setViewerReloadKey,
    startTransition
  } = input

  const handleAddCurrentPageTextToAi = useCallback(
    () => extractCurrentPageTextRef.current(),
    [extractCurrentPageTextRef]
  )
  const handleSendPageAsImageToAi = useCallback(
    () => handleFullPageScreenshotRef.current(),
    [handleFullPageScreenshotRef]
  )

  const handleZoom = useCallback(
    (e: { scale: number }) => {
      setScaleFactor(Math.min(e.scale, PDF_ZOOM_MAX_SCALE))
    },
    [setScaleFactor]
  )

  const handleJumpToPage = useCallback(
    (page: number) => {
      jumpToPageFromNav(page)
    },
    [jumpToPageFromNav]
  )

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), [setContextMenu])

  const handleReload = useCallback(() => {
    startTransition(() => {
      setViewerReloadKey((c) => c + 1)
    })
  }, [setViewerReloadKey, startTransition])

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        label: tt('pdf_add_current_page_text_to_ai'),
        icon: Type,
        onClick: handleAddCurrentPageTextToAi
      },
      { label: tt('pdf_send_page_as_image'), icon: ImageIcon, onClick: handleSendPageAsImageToAi },
      { label: tt('ctx_crop_screenshot_ai'), icon: Crop, onClick: () => handleAreaScreenshot() },
      { separator: true, label: '', onClick: () => {} },
      {
        label: t('ctx_reload'),
        icon: RefreshCw,
        onClick: handleReload,
        shortcut: 'Ctrl+R',
        danger: true
      }
    ],
    [
      t,
      tt,
      handleAddCurrentPageTextToAi,
      handleSendPageAsImageToAi,
      handleAreaScreenshot,
      handleReload
    ]
  )

  return {
    handleAddCurrentPageTextToAi,
    handleSendPageAsImageToAi,
    handleReload,
    handleZoom,
    handleJumpToPage,
    handleCloseContextMenu,
    menuItems
  }
}
