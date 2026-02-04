import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * PDF sağ tık menüsünü yöneten custom hook
 * Container içindeki sağ tıklamaları yakalayıp main process'e iletir
 * @param {React.RefObject} containerRef - PDF container ref
 */
type TranslationFn = (key: string) => string

export function usePdfContextMenu(containerRef: RefObject<HTMLElement | null>, t?: TranslationFn) {
    useEffect(() => {
        const handleContextMenuGlobal = (e: MouseEvent) => {
            const container = containerRef.current
            // Tıklama container içindeyse yakala
            if (container && e.target instanceof Node && container.contains(e.target)) {
                e.preventDefault()
                e.stopPropagation() // Diğer dinleyicileri durdur

                if (window.electronAPI?.showPdfContextMenu) {
                    // Send localized labels
                    const labels = t ? {
                        full_page_screenshot: t('ctx_full_page_screenshot'),
                        crop_screenshot: t('ctx_crop_screenshot'),
                        zoom_in: t('ctx_zoom_in'),
                        zoom_out: t('ctx_zoom_out'),
                        reset_zoom: t('ctx_reset_zoom'),
                        reload: t('ctx_reload')
                    } : {}

                    window.electronAPI.showPdfContextMenu(labels)
                } else {
                    console.warn('[PdfContextMenu] Sağ tık API bulunamadı (Preload güncel değil mi?)')
                }
            }
        }

        // Document seviyesinde capture true ile yakala
        document.addEventListener('contextmenu', handleContextMenuGlobal, true)

        return () => {
            document.removeEventListener('contextmenu', handleContextMenuGlobal, true)
        }
    }, [containerRef, t])
}
