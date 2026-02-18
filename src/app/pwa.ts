import { registerSW } from 'virtual:pwa-register'
import { Logger } from '@src/utils/logger'

export function registerPWA() {
    if ('serviceWorker' in navigator) {
        registerSW({
            onNeedRefresh() {
                // Show update prompt if needed
                Logger.info('New content available, click on reload button to update.')
            },
            onOfflineReady() {
                Logger.info('App ready to work offline')
            },
        })
    }
}
