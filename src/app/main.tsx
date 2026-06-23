import './wdyr'
import '@shared/styles/index.css'
import '@shared/i18n/i18next'

import { createBrowserElectronApi } from '@platform/electron/createBrowserElectronApi'

import App from '@app/App'
import { AppProviders } from '@app/providers/AppProviders'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { hasElectronApi } from '@shared/lib/electronApi'
import { useLanguageInit } from '@shared/stores/languageStore'
import BrowserFallback from '@ui/components/BrowserFallback'
import ErrorBoundary from '@ui/components/ErrorBoundary'

import i18next from 'i18next'
import { createRoot } from 'react-dom/client'

function InitWrapper({ children }: { children: React.ReactNode }) {
  useLanguageInit()
  return <>{children}</>
}

const rootElement = document.getElementById('root') as HTMLElement
const root = createRoot(rootElement)

const isElectron = hasElectronApi()
const isWebDevMode = !isElectron && import.meta.env.DEV

if (isWebDevMode) {
  window.electronAPI = createBrowserElectronApi()
}

const savedLang = (() => {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE)
    return val
  } catch {
    return null
  }
})()

if (savedLang && savedLang !== 'en') {
  void i18next.changeLanguage(savedLang)
}

if (!isElectron && !isWebDevMode) {
  root.render(<BrowserFallback />)
} else {
  root.render(
    <AppProviders>
      <InitWrapper>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </InitWrapper>
    </AppProviders>
  )
}
