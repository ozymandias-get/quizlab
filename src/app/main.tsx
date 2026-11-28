import '@fontsource-variable/inter'
import '@shared/styles/index.css'
import '@shared/i18n/i18next'

if (import.meta.env.DEV) {
  void import('./wdyr')
}

import { createBrowserElectronApi } from '@platform/electron/createBrowserElectronApi'

import { resetReadingProgressStore } from '@features/pdf'

import App from '@app/App'
import BrowserFallback from '@app/components/BrowserFallback'
import { installErrorReporting } from '@app/lib/errorReporting'
import { hydrateSettingsFromMain, installSettingsSync } from '@app/lib/settingsSync'
import { AppProviders } from '@app/providers'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { getStorageItem } from '@shared/hooks/localStorageUtils'
import { hasElectronApi } from '@shared/lib/electronApi'
import { hydratePreferenceStores } from '@shared/stores/hydratePreferenceStores'
import { useLanguageInit } from '@shared/stores/languageStore'
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

  // Platform-aware chrome: the Windows title-bar overlay needs a right-side
  // safe area on the tab strips so window controls never cover a tab.
  const platform = window.electronAPI?.platform
  if (platform) {
    document.documentElement.dataset.platform = platform
  }

  // Restore persisted preferences from the main process ConfigManager store
  // BEFORE React mounts so stores/hooks that read localStorage synchronously
  // pick up the saved values (appearance, prompts, selector settings, ...).
  if (isElectron) {
    await hydrateSettingsFromMain()
    await hydratePreferenceStores()
    // The reading-progress store is the third module-init snapshot of a synced
    // key, and `hydratePreferenceStores` cannot reach it: a feature store is not
    // a shared store, and importing it from `src/shared` would invert the
    // dependency direction. Called from here instead, where the bootstrap
    // ordering already lives. Skipping it does not merely hide the recent list —
    // the first progress write persists that empty list back over the real
    // history, in both localStorage and the main process store.
    resetReadingProgressStore()
  }

  // Mirror whitelisted localStorage writes back to the main process store so
  // preferences survive restarts instead of silently reverting.
  installSettingsSync()

  // Surface async/effect errors that React's ErrorBoundary cannot see, and keep
  // PDF.js render-cancellation races out of the toast. The two listeners have a
  // required order, so they are installed together; see `installErrorReporting`.
  installErrorReporting()

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
