import type { PdfActionPoint } from '@shared-core/types'

import { Crop, Image as ImageIcon, RefreshCw, Type } from 'lucide-react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useCallback, useMemo } from 'react'

import type { MenuItem } from '../ui/components/ContextMenu'

interface MenuItemsInput {
  t: (key: string) => string
  tt: (key: string) => string
  handleAreaScreenshot: () => void
  /**
   * `extractCurrentPageText` ve `handleFullPageScreenshot`, kullanıcının
   * **eylemini doğuran noktayı** opsiyonel olarak alır. Sağ tık menüsünden
   * gelenlerde bu nokta vardır ve karar menüsü oraya konumlanır; kısayoldan
   * gelenlerde yoktur.
   */
  extractCurrentPageTextRef: MutableRefObject<(point?: PdfActionPoint) => string | null>
  handleFullPageScreenshotRef: MutableRefObject<(point?: PdfActionPoint) => Promise<void>>
  setContextMenu: (menu: { x: number; y: number } | null) => void
  /** Kapanmayan son sağ tık noktası — menü öğesi handler'ları buradan okur. */
  contextMenuPointRef: MutableRefObject<PdfActionPoint | null>
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
 * Zoom and page-jump are absent from this list on purpose: the native controller
 * owns its scale outright and owns `jumpToPage`, so the toolbar binds them
 * directly and there is no clamp for an adapter to apply.
 */
export function usePdfViewerMenuItems(input: MenuItemsInput): MenuItemsOutput {
  const {
    t,
    tt,
    handleAreaScreenshot,
    extractCurrentPageTextRef,
    handleFullPageScreenshotRef,
    setContextMenu,
    contextMenuPointRef,
    setViewerReloadKey,
    startTransition
  } = input

  /**
   * Sağ tık noktası, öğeye tıklandığı anda okunur.
   *
   * `null` "bu yol bir noktadan tetiklenmedi" demektir (ör. araç çubuğu ya da
   * kısayol); çağıran o zaman kendi varsayılanına düşer.
   */
  const handleAddCurrentPageTextToAi = useCallback(
    () => extractCurrentPageTextRef.current(contextMenuPointRef.current ?? undefined),
    [extractCurrentPageTextRef, contextMenuPointRef]
  )
  const handleSendPageAsImageToAi = useCallback(
    () => handleFullPageScreenshotRef.current(contextMenuPointRef.current ?? undefined),
    [handleFullPageScreenshotRef, contextMenuPointRef]
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
