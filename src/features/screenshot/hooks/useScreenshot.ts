import { useState, useCallback } from 'react'

interface UseScreenshotReturn {
    isScreenshotMode: boolean;
    startScreenshot: () => void;
    closeScreenshot: () => void;
    handleCapture: (imageData: string) => Promise<void>;
}

/**
 * Ekran görüntüsü alma işlemlerini yöneten hook
 * @param {Function} onSendToAI - Görüntüyü AI'ya gönderme fonksiyonu
 * @returns {Object} - Screenshot durumu ve fonksiyonları
 */
export function useScreenshot(onSendToAI?: (imageData: string) => Promise<unknown>): UseScreenshotReturn {
    const [isScreenshotMode, setIsScreenshotMode] = useState<boolean>(false)

    /**
     * Ekran görüntüsü modunu başlat
     */
    const startScreenshot = useCallback(() => {
        setIsScreenshotMode(true)
    }, [])

    /**
     * Ekran görüntüsü modunu kapat
     */
    const closeScreenshot = useCallback(() => {
        setIsScreenshotMode(false)
    }, [])

    /**
     * Ekran görüntüsü yakalandığında
     * @param {string} imageData - Base64 formatında görüntü verisi
     */
    const handleCapture = useCallback(async (imageData: string) => {
        setIsScreenshotMode(false)

        // Görüntüyü AI'ya gönder
        if (onSendToAI) {
            await onSendToAI(imageData)
        }
    }, [onSendToAI])

    return {
        isScreenshotMode,
        startScreenshot,
        closeScreenshot,
        handleCapture
    }
}

