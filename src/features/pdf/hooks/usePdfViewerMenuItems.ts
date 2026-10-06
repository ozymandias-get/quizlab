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
  setContextMenu: (menu: { x: number; y: number } | null) => void
  setViewerReloadKey: Dispatch<SetStateAction<number>>
  startTransition: (fn: () => void) => void
}

interface MenuItemsOutput {
  handleAddCurrentPageTextToAi: () => void
  handleSendPageAsImageToAi: () => void
  handleReload: () => void
  handleCloseContextMenu: () => void
  menuItems: MenuItem[]
}

/**
 * The context-menu items and the two handlers the toolbar also uses.
 *
 * `handleZoom` and `handleJumpToPage` used to live here as the `@react-pdf-viewer`
 * adapters — the first clamped whatever scale the viewer's `onZoom` reported, the
 * second forwarded to the navigation hook's jump. Both were removed with the
 * viewer: the native controller owns its scale outright and owns `jumpToPage`, so
 * the toolbar binds them directly and there is nothing left to clamp.
 */
export function usePdfViewerMenuItems(input: MenuItemsInput): MenuItemsOutput {
  const {
    t,
    tt,
    handleAreaScreenshot,
    extractCurrentPageTextRef,
    handleFullPageScreenshotRef,
    setContextMenu,
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
    handleCloseContextMenu,
    menuItems
  }
}
