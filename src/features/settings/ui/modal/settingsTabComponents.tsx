import { type ComponentType, lazy, memo } from 'react'

import { useSettings } from '../../hooks/useSettings'
import type { SettingsContext, SettingsTabId } from './settingsTabDefinitions'

const SelectorsTab = lazy(() => import('../SelectorsTab'))
const TutorialCenterTab = lazy(() => import('../TutorialCenterTab'))
const AboutTab = lazy(() => import('../AboutTab'))

export const SelectorsTabWrapper = memo(function SelectorsTabWrapper({ onClose }: SettingsContext) {
  return <SelectorsTab onCloseSettings={onClose} />
})

export const TutorialTabWrapper = memo(function TutorialTabWrapper({ onClose }: SettingsContext) {
  return <TutorialCenterTab onCloseSettings={onClose} />
})

export const AboutTabWrapper = memo(function AboutTabWrapper({ onClose }: SettingsContext) {
  const settings = useSettings()
  return (
    <AboutTab
      appVersion={settings.appVersion}
      updateStatus={settings.updateStatus}
      updateInfo={settings.updateInfo}
      checkForUpdates={settings.checkForUpdates}
      openReleasesPage={settings.openReleasesPage}
      onClose={onClose}
    />
  )
})

const LanguageTab = lazy(() => import('../LanguageTab'))
const SitesTab = lazy(() => import('../SitesTab'))
const ModelsTab = lazy(() => import('../ModelsTab'))
const AppearanceTab = lazy(() => import('../AppearanceTab'))
const PromptsTab = lazy(() => import('../PromptsTab'))
const ApiChatTab = lazy(() => import('../ApiSettingsTab'))
const NotificationsTab = lazy(() => import('../NotificationsTab'))
const AiLifecycleTab = lazy(() => import('../AiLifecycleTab'))
const BottomBarSettingsTab = lazy(() => import('../BottomBarSettingsTab'))
const TextInputModeTab = lazy(() => import('../TextInputModeTab'))
const GeminiWebSessionTab = lazy(() => import('../GeminiWebSessionTab'))
const StorageTab = lazy(() => import('../StorageTab'))

export const SETTINGS_TAB_COMPONENTS: Record<SettingsTabId, ComponentType<SettingsContext>> = {
  prompts: PromptsTab,
  models: ModelsTab,
  sites: SitesTab,
  'ai-lifecycle': AiLifecycleTab,
  'text-input-mode': TextInputModeTab,
  'gemini-web': GeminiWebSessionTab,
  selectors: SelectorsTabWrapper,
  notifications: NotificationsTab,
  appearance: AppearanceTab,
  'bottom-bar': BottomBarSettingsTab,
  language: LanguageTab,
  tutorial: TutorialTabWrapper,
  about: AboutTabWrapper,
  'api-chat': ApiChatTab,
  storage: StorageTab
} as unknown as Record<SettingsTabId, ComponentType<SettingsContext>>
