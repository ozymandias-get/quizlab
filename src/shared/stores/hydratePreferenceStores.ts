import { useAppearance } from './appearanceStore'
import { getInitialLanguage, getInitialOnboardingDone, useLanguage } from './languageStore'

/** Refresh stores initialized by static imports before the main-process restore. */
export async function hydratePreferenceStores(): Promise<void> {
  await useAppearance.persist.rehydrate()
  useLanguage.setState({
    language: getInitialLanguage(),
    isOnboardingDone: getInitialOnboardingDone()
  })
}
