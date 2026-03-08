import { useEffect, useCallback } from 'react'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { Logger } from '@shared/lib/logger'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

const { SCREENSHOT_TYPES } = APP_CONSTANTS

interface UsePdfScreenshotOptions {
    currentPage: number;
    queueImageForAi: (dataUrl: string, imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>) => void;
    startScreenshot: (mode?: 'full' | 'crop', imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>) => void;
}

export function usePdfScreenshot({ currentPage, queueImageForAi, startScreenshot }: UsePdfScreenshotOptions) {
    const canvasToDataURLAsync = (canvas: HTMLCanvasElement): Promise<string> => {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas boş veya oluşturulamadı'))
                const reader = new FileReader()
                reader.onloadend = () => resolve(String(reader.result))
                reader.onerror = reject
                reader.readAsDataURL(blob)
            }, 'image/png', 1.0)
        })
    }

    const handleFullPageScreenshot = useCallback(async () => {
        try {
            let targetCanvas: HTMLCanvasElement | null = null
            const pageIndex = currentPage - 1
            const maxAttempts = 10

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const specificLayer = document.querySelector(`.rpv-core__page-layer[data-page-number="${pageIndex}"]`)
                    if (specificLayer) {
                        const canvas = specificLayer.querySelector('canvas') as HTMLCanvasElement | null
                        if (canvas && canvas.width > 0 && canvas.height > 0) {
                            targetCanvas = canvas
                            break
                        }
                    }

                    if (attempt > 2) {
                        const allCanvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('.rpv-core__page-layer canvas'))

                        if (allCanvases.length === 0 && attempt > 5) {
                            const anyCanvas = document.querySelector('.pdf-viewer-container canvas') as HTMLCanvasElement | null
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

                await new Promise((resolve) => setTimeout(resolve, 50))
            }

            if (!targetCanvas) {
                Logger.warn('[PdfScreenshot] Canvas bulunamadı, ekran görüntüsü alınamıyor.')
                return
            }

            const dataUrl = await canvasToDataURLAsync(targetCanvas)
            queueImageForAi(dataUrl, {
                page: currentPage,
                captureKind: 'full-page'
            })
        } catch (error) {
            Logger.error('[PdfScreenshot] Full page capture error:', error)
        }
    }, [currentPage, queueImageForAi])

    useEffect(() => {
        if (!window.electronAPI?.onTriggerScreenshot) return

        const removeListener = window.electronAPI.onTriggerScreenshot((type) => {
            if (type === SCREENSHOT_TYPES.CROP) {
                startScreenshot('crop', {
                    page: currentPage,
                    captureKind: 'selection'
                })
            } else if (type === SCREENSHOT_TYPES.FULL) {
                void handleFullPageScreenshot()
            }
        })

        return () => {
            if (typeof removeListener === 'function') removeListener()
        }
    }, [currentPage, handleFullPageScreenshot, startScreenshot])

    return { handleFullPageScreenshot }
}
