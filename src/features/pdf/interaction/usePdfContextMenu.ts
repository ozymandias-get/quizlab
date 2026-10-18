/**
 * PDF context menu hook — captures right-click events on the PDF container
 * and provides position state for the context menu component.
 */
import type { PdfActionPoint } from '@shared-core/types'

import { type RefObject, useEffect, useRef, useState } from 'react'

export function usePdfContextMenu(containerRef: RefObject<HTMLElement | null>) {
  const [contextMenu, setContextMenu] = useState<PdfActionPoint | null>(null)

  /**
   * Son sağ tık noktası — menü kapansa da **silinmez**.
   *
   * `ContextMenu` bir öğeye tıklanınca `onClick()`'i çağırıp hemen ardından
   * `onClose()` ile state'i temizler. Nokta yalnızca state'te duruyorsa, o
   * öğeden yürüyen her şey (sayfa metni, sayfa görseli) noktayı kaybeder; o
   * zincirler asenkron tamamlandığı için "şu an nerede tıklandı" sorusunun
   * tek ve doğru yanıtı kalmaz. Ref bu soruyu kapanmadan da yanıtlayabilir.
   */
  const contextMenuPointRef = useRef<PdfActionPoint | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const point: PdfActionPoint = { x: e.clientX, y: e.clientY }
      contextMenuPointRef.current = point
      setContextMenu(point)
    }

    el.addEventListener('contextmenu', handleContextMenu)

    return () => {
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [containerRef])

  return { contextMenu, setContextMenu, contextMenuPointRef }
}
