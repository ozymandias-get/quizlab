import { removeStorageItem } from '@shared/hooks/localStorageUtils'
import { hexToRgba } from '@shared/lib/uiUtils'
import { useAppearance } from '@shared/stores/appearanceStore'
import { DEFAULT_LANGUAGE, LANGUAGES, useLanguage } from '@shared/stores/languageStore'

import i18next from 'i18next'
import { useEffect } from 'react'

function applySelectionColorTheme(color: string) {
  const root = document.documentElement
  root.style.setProperty('--selection-color-strong', hexToRgba(color, 0.7))
  root.style.setProperty('--selection-color-ink', 'rgba(24, 24, 27, 0.96)')
  /* The user's hue with no alpha baked in, so a surface that wants a translucent
     selection derives its own alpha from it instead of inheriting whichever of the
     opaque tokens above happens to suit its background. The PDF text layer is the
     first such consumer: it paints the tint over the canvas's own glyphs, so its
     alpha has to be chosen for legibility over arbitrary page content rather than
     for a themed UI surface. Nothing here is a new preference — the value is the
     same `selectionColor` the rest of this function already reads. */
  root.style.setProperty('--selection-color-source', color)
}

function AppEffects() {
  const language = useLanguage((state) => state.language)
  const selectionColor = useAppearance((state) => state.selectionColor)

  useEffect(() => {
    // Dark is the only theme now. The class stays so existing `dark:` utility
    // variants keep applying; there is no theme switch to remove it.
    document.documentElement.classList.add('dark')
  }, [])

  useEffect(() => {
    function applyLang(lng: string) {
      const langConfig = LANGUAGES[lng] || LANGUAGES[DEFAULT_LANGUAGE]
      document.documentElement.dir = langConfig?.dir || 'ltr'
      document.documentElement.lang = lng
    }
    applyLang(language)
    i18next.on('languageChanged', applyLang)
    return () => {
      i18next.off('languageChanged', applyLang)
    }
  }, [language])

  useEffect(() => {
    applySelectionColorTheme(selectionColor)
  }, [selectionColor])

  // Remove legacy keys from removed experiments/features. `ocr-storage` is
  // left behind on disks that ran a version with the local OCR integration.
  // The tutorial keys below belong to the removed usage-guide system
  // (`tutorial-storage` zustand persist, `has_seen_tour_v1` auto-tour flag and
  // two reserved keys that were never written). Removing them is idempotent
  // and touches nothing else the user has stored.
  useEffect(() => {
    removeStorageItem('useCustomPdfEngine')
    removeStorageItem('ocr-storage')
    removeStorageItem('has_seen_tour_v1')
    removeStorageItem('tutorial-storage')
    removeStorageItem('tutorial-completion')
    removeStorageItem('tutorial-onboarding-done')
  }, [])

  return null
}

export default AppEffects
