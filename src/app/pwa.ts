import { Logger } from '@src/utils/logger'

export function registerPWA() {
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window
    if (isElectron || !('serviceWorker' in navigator)) return

    void import('virtual:pwa-register')
        .then(({ registerSW }) => {
            registerSW({
                onNeedRefresh() {
                    Logger.info('New content available, click on reload button to update.')
                },
                onOfflineReady() {
                    Logger.info('App ready to work offline')
                },
            })
        })
        .catch((error: unknown) => {
            Logger.warn('[PWA] Service worker registration skipped:', error)
        })
}
