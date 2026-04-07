import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProviders } from './providers'
import '@shared/styles/index.css'
import { createBrowserElectronApi } from '@platform/electron/createBrowserElectronApi'
import { hasElectronApi } from '@shared/lib/electronApi'

import BrowserFallback from '@ui/components/BrowserFallback'

const rootElement = document.getElementById('root') as HTMLElement
const root = createRoot(rootElement)

const isElectron = hasElectronApi()
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
