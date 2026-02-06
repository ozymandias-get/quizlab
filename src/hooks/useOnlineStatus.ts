import { useState, useEffect } from 'react'
import { useToast, useLanguage } from '@src/app/providers'

/**
 * Provides online/offline status
 * Automatically notifies user via Toast when connection status changes
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const { showWarning, showSuccess } = useToast()
    const { t } = useLanguage()

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            showSuccess('connection_restored')
        }

        const handleOffline = () => {
            setIsOnline(false)
            showWarning('connection_lost')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [showSuccess, showWarning, t]) // t dependency usually stable

    return isOnline
}

