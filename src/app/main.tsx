import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProviders } from './providers'
import '@shared/styles/index.css'
import { createBrowserElectronApi } from '@platform/electron/createBrowserElectronApi'

import BrowserFallback from '@ui/components/BrowserFallback'

const rootElement = document.getElementById('root') as HTMLElement
const root = createRoot(rootElement)

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window
const isWebDevMode = !isElectron && import.meta.env.DEV

if (isWebDevMode) {
  window.electronAPI = createBrowserElectronApi()
}

if (!isElectron && !isWebDevMode) {
  root.render(<BrowserFallback />)
} else {
  root.render(
    <AppProviders>
      <App />
    </AppProviders>
  )
}
