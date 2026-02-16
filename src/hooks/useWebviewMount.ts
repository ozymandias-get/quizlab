import { useState, useEffect } from 'react'

export function useWebviewMount() {
    const [isWebviewMounted, setIsWebviewMounted] = useState<boolean>(false)

    useEffect(() => {
        let cancelled = false
        const browserWindow = window as Window & {
            requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
            cancelIdleCallback?: (handle: number) => void;
        }

        const mountWebview = () => {
            if (!cancelled) setIsWebviewMounted(true)
        }

        if (browserWindow.requestIdleCallback) {
            const idleId = browserWindow.requestIdleCallback(mountWebview, { timeout: 300 })
            return () => {
                cancelled = true
                browserWindow.cancelIdleCallback?.(idleId)
            }
        }

        const timeoutId = globalThis.setTimeout(mountWebview, 120)
        return () => {
            cancelled = true
            globalThis.clearTimeout(timeoutId)
        }
    }, [])

    return isWebviewMounted
}
