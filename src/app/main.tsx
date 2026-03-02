import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProviders } from './providers'
import '@shared/styles/index.css'
import { createBrowserElectronApi } from '@platform/electron/createBrowserElectronApi'

import BrowserFallback from '@ui/components/BrowserFallback'

const rootElement = document.getElementById('root') as HTMLElement
const root = ReactDOM.createRoot(rootElement)

// Safely check if we are running inside the Electron isolated environment
const isElectron = typeof window !== 'undefined' && 'electronAPI' in window
const isWebDevMode = !isElectron && import.meta.env.DEV

if (isWebDevMode) {
    window.electronAPI = createBrowserElectronApi()
    console.info('[quizlab] Running in web dev mode with mocked electronAPI bridge.')
}

if (!isElectron && !isWebDevMode) {
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

