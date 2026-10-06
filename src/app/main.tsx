import '@shared/styles/index.css'
import '@shared/i18n/i18next'

if (import.meta.env.DEV) {
  void import('./wdyr')
}

import { createBrowserElectronApi } from '@platform/electron/createBrowserElectronApi'

import { installPdfRenderErrorGuard } from '@features/pdf'

import App from '@app/App'
import { AppProviders } from '@app/providers'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { getStorageItem } from '@shared/hooks/localStorageUtils'
import { hasElectronApi } from '@shared/lib/electronApi'
import { installGlobalErrorHandlers } from '@shared/lib/globalErrorHandlers'
import { hydrateSettingsFromMain, installSettingsSync } from '@shared/lib/settingsSync'
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

async function bootstrap() {
  const isElectron = hasElectronApi()
  const isWebDevMode = !isElectron && import.meta.env.DEV

  if (isWebDevMode) {
    window.electronAPI = createBrowserElectronApi()
  }

  // Restore persisted preferences from the main process ConfigManager store
  // BEFORE React mounts so stores/hooks that read localStorage synchronously
  // pick up the saved values (theme, prompts, selector settings, ...).
  if (isElectron) {
    await hydrateSettingsFromMain()
  }

  // Mirror whitelisted localStorage writes back to the main process store so
  // preferences survive restarts instead of silently reverting.
  installSettingsSync()

  // Surface async/effect errors that React's ErrorBoundary cannot see.
  installGlobalErrorHandlers()

  // Keep PDF.js render-cancellation races out of the console. Registered *after*
  // `installGlobalErrorHandlers`, which honours `defaultPrevented`, so marking the
  // event here also suppresses the in-app toast. It is a window listener with no
  // React or viewer dependency, so it belongs at boot rather than inside a
  // renderer component: it used to hang off `PdfWorkerHost`, which meant it was
  // installed lazily, once per mounted viewer, and only for as long as a PDF
  // panel existed.
  installPdfRenderErrorGuard()

  const savedLang = getStorageItem(STORAGE_KEYS.APP_LANGUAGE)

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
}

void bootstrap()
