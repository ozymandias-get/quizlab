import { useEffect, useCallback } from 'react'
import { Logger } from '@src/utils/logger'
import { APP_CONSTANTS } from '@src/constants/appConstants'

const { SCREENSHOT_TYPES } = APP_CONSTANTS

/**
 * PDF screenshot alma işlemlerini yöneten custom hook
 * @param {Object} options - Hook options
 * @param {number} options.currentPage - Mevcut sayfa numarası
 * @param {Function} options.sendImageToAI - Görüntüyü AI'ya gönderen fonksiyon
 * @param {Function} options.startScreenshot - Crop screenshot başlatan fonksiyon
 */
interface UsePdfScreenshotOptions {
    currentPage: number;
    sendImageToAI: (dataUrl: string) => Promise<unknown>;
    startScreenshot: (mode?: 'full' | 'crop') => void;
}

export function usePdfScreenshot({ currentPage, sendImageToAI, startScreenshot }: UsePdfScreenshotOptions) {

    // Yardımcı: Ana thread'i bloklamadan Canvas -> DataURL dönüşümü
    const canvasToDataURLAsync = (canvas: HTMLCanvasElement): Promise<string> => {
        return new Promise((resolve, reject) => {
            // toBlob asenkron çalışır ve UI'ı dondurmaz
            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas boş veya oluşturulamadı'))
                const reader = new FileReader()
                reader.onloadend = () => resolve(String(reader.result))
                reader.onerror = reject
                reader.readAsDataURL(blob)
            }, 'image/png', 1.0)
        })
    }

    // Tam Sayfa Screenshot Alma (Canvas'tan)
    const handleFullPageScreenshot = useCallback(async () => {
        try {
            let targetCanvas: HTMLCanvasElement | null = null
            const pageIndex = currentPage - 1
            const maxAttempts = 10 // 500ms toplam bekleme süresi

            // Canvas'ın render edilmesini bekle (Polling)
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    // Method 1: Kesin sayfa eşleşmesi
                    const specificLayer = document.querySelector(`.rpv-core__page-layer[data-page-number="${pageIndex}"]`)
                    if (specificLayer) {
                        const canvas = specificLayer.querySelector('canvas') as HTMLCanvasElement | null
                        // Canvas var ve boyutu > 0 ise hazır demektir
                        if (canvas && canvas.width > 0 && canvas.height > 0) {
                            targetCanvas = canvas
                            break
                        }
                    }

                    // Method 2: Görünür alandaki en büyük canvas (Fallback)
                    if (attempt > 2) {
                        const allCanvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('.rpv-core__page-layer canvas'))

                        // Robust Fallback: If no canvases found with specific class, try generic selector
                        if (allCanvases.length === 0 && attempt > 5) {
                            const anyCanvas = document.querySelector('.pdf-viewer-container canvas') as HTMLCanvasElement
                            if (anyCanvas && anyCanvas.width > 0) {
                                targetCanvas = anyCanvas
                                break
                            }
                        }

                        let maxVisibleArea = -1
                        let bestCandidate: HTMLCanvasElement | null = null

                        for (const canvas of allCanvases) {
                            if (canvas.width === 0 || canvas.height === 0) continue

                            const rect = canvas.getBoundingClientRect()
                            const intersectionTop = Math.max(0, rect.top)
                            const intersectionBottom = Math.min(window.innerHeight, rect.bottom)
                            const intersectionLeft = Math.max(0, rect.left)
                            const intersectionRight = Math.min(window.innerWidth, rect.right)

                            if (intersectionBottom > intersectionTop && intersectionRight > intersectionLeft) {
                                const visibleArea = (intersectionBottom - intersectionTop) * (intersectionRight - intersectionLeft)
                                if (visibleArea > maxVisibleArea) {
                                    maxVisibleArea = visibleArea
                                    bestCandidate = canvas
                                }
                            }
                        }

                        if (bestCandidate) {
                            targetCanvas = bestCandidate
                            break
                        }
                    }
                } catch (innerErr) {
                    Logger.warn('[PdfScreenshot] Attempt failed:', innerErr)
                }

                // Biraz bekle ve tekrar dene
                await new Promise(r => setTimeout(r, 50))
            }

            if (!targetCanvas) {
                Logger.warn('[PdfScreenshot] Canvas bulunamadı, screenshot alınamıyor.')
                return
            }

            // Performanslı dönüşüm ve gönderim
            const dataUrl = await canvasToDataURLAsync(targetCanvas)
            await sendImageToAI(dataUrl)

        } catch (error) {
            Logger.error('[PdfScreenshot] Full page capture error:', error)
        }
    }, [sendImageToAI, currentPage])

    // Main Process'ten gelen tetikleyicileri dinle (Right Click Menu)
    useEffect(() => {
        if (!window.electronAPI?.onTriggerScreenshot) return

        const removeListener = window.electronAPI.onTriggerScreenshot((type) => {
            if (type === SCREENSHOT_TYPES.CROP) {
                startScreenshot()
            } else if (type === SCREENSHOT_TYPES.FULL) {
                handleFullPageScreenshot()
            }
        })

        return () => {
            if (typeof removeListener === 'function') removeListener()
        }
    }, [startScreenshot, handleFullPageScreenshot])

    return { handleFullPageScreenshot }
}

