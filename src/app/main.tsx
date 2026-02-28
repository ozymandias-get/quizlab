import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProviders } from './providers'
import '@src/styles/index.css'

import { registerPWA } from './pwa'
import BrowserFallback from '@src/components/ui/BrowserFallback'

const rootElement = document.getElementById('root') as HTMLElement
const root = ReactDOM.createRoot(rootElement)

// Safely check if we are running inside the Electron isolated environment
const isElectron = typeof window !== 'undefined' && 'electronAPI' in window

if (!isElectron) {
    registerPWA()

    // Render the fallback screen when running in browser mode
    root.render(<BrowserFallback />)
} else {
    // Render the actual application inside Electron
    root.render(
        <AppProviders>
            <App />
        </AppProviders>
    )
}
