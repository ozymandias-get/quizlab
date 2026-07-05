import { AiIcon } from '@shared/ui/components/icons/AiIcon'
import {
  BellIcon,
  EyeIcon,
  GeminiIcon,
  GridIcon,
  InfoIcon,
  KeyboardIcon,
  LanguageIcon,
  MagicWandIcon,
  RefreshIcon,
  SelectorIcon,
  type SettingsIcon,
  SliderIcon
} from '@ui/components/Icons'

import { type ComponentType, lazy, memo } from 'react'

import { useSettings } from '../../hooks/useSettings'

const LanguageTab = lazy(() => import('../LanguageTab'))
const AboutTab = lazy(() => import('../AboutTab'))
const SitesTab = lazy(() => import('../SitesTab'))
const ModelsTab = lazy(() => import('../ModelsTab'))
const AppearanceTab = lazy(() => import('../AppearanceTab'))
const SelectorsTab = lazy(() => import('../SelectorsTab'))
const GeminiWebSessionTab = lazy(() => import('../GeminiWebSessionTab'))
const PromptsTab = lazy(() => import('../PromptsTab'))
const ApiChatTab = lazy(() => import('../ApiSettingsTab'))
const NotificationsTab = lazy(() => import('../NotificationsTab'))
const AiLifecycleTab = lazy(() => import('../AiLifecycleTab'))
const BottomBarSettingsTab = lazy(() => import('../BottomBarSettingsTab'))
const TextInputModeTab = lazy(() => import('../TextInputModeTab'))
const TutorialCenterTab = lazy(() => import('../TutorialCenterTab'))
const StorageTab = lazy(() => import('../StorageTab'))

function ApiChatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return <AiIcon modelKey="api-chat" className={className} />
}

const SETTINGS_SIDEBAR_GROUP_ORDER = ['workspace', 'integration', 'preferences', 'app'] as const

export type SettingsTabGroup = (typeof SETTINGS_SIDEBAR_GROUP_ORDER)[number]

interface SettingsTabMeta {
  id: string
  group: SettingsTabGroup
  labelKey: string
  descriptionKey: string
  icon: typeof SettingsIcon
  accent: string
  glow: string
}

const SETTINGS_TABS = [
  {
    id: 'prompts',
    group: 'workspace',
    labelKey: 'prompts',
    descriptionKey: 'prompts_description',
    icon: MagicWandIcon,
    accent: 'from-amber-300/28 via-orange-200/12 to-transparent',
    glow: '#f59e0b'
  },
  {
    id: 'models',
    group: 'workspace',
    labelKey: 'models',
    descriptionKey: 'models_description',
    icon: GridIcon,
    accent: 'from-sky-300/28 via-cyan-200/12 to-transparent',
    glow: '#38bdf8'
  },
  {
    id: 'sites',
    group: 'workspace',
    labelKey: 'ai_sites',
    descriptionKey: 'sites_description',
    icon: GridIcon,
    accent: 'from-emerald-300/28 via-teal-200/12 to-transparent',
    glow: '#34d399'
  },
  {
    id: 'ai-lifecycle',
    group: 'workspace',
    labelKey: 'ai_lifecycle',
    descriptionKey: 'ai_lifecycle_description',
    icon: SliderIcon,
    accent: 'from-violet-300/28 via-purple-200/12 to-transparent',
    glow: '#8b5cf6'
  },
  {
    id: 'text-input-mode',
    group: 'workspace',
    labelKey: 'text_input_mode',
    descriptionKey: 'text_input_mode_description',
    icon: KeyboardIcon,
    accent: 'from-orange-300/28 via-amber-200/12 to-transparent',
    glow: '#f97316'
  },
  {
    id: 'api-chat',
    group: 'integration',
    labelKey: 'api_chat_settings_title',
    descriptionKey: 'api_chat_settings_desc',
    icon: ApiChatIcon,
    accent: 'from-amber-300/28 via-amber-200/12 to-transparent',
    glow: '#f59e0b'
  },
  {
    id: 'gemini-web',
    group: 'integration',
    labelKey: 'gws_title',
    descriptionKey: 'gws_state_authenticated',
    icon: GeminiIcon,
    accent: 'from-violet-300/28 via-indigo-200/12 to-transparent',
    glow: '#8b5cf6'
  },
  {
    id: 'selectors',
    group: 'integration',
    labelKey: 'selectors',
    descriptionKey: 'selectors_description_simple',
    icon: SelectorIcon,
    accent: 'from-white/28 via-white/12 to-transparent',
    glow: '#d4d4d8'
  },
  {
    id: 'notifications',
    group: 'preferences',
    labelKey: 'notifications',
    descriptionKey: 'notifications_description',
    icon: BellIcon,
    accent: 'from-emerald-300/28 via-teal-200/12 to-transparent',
    glow: '#34d399'
  },
  {
    id: 'appearance',
    group: 'preferences',
    labelKey: 'appearance',
    descriptionKey: 'appearance_description',
    icon: EyeIcon,
    accent: 'from-rose-300/28 via-red-200/10 to-transparent',
    glow: '#fb7185'
  },
  {
    id: 'bottom-bar',
    group: 'preferences',
    labelKey: 'bottom_bar',
    descriptionKey: 'bottom_bar_description',
    icon: SliderIcon,
    accent: 'from-sky-300/28 via-cyan-200/12 to-transparent',
    glow: '#38bdf8'
  },
  {
    id: 'language',
    group: 'preferences',
    labelKey: 'language',
    descriptionKey: 'language_description',
    icon: LanguageIcon,
    accent: 'from-lime-300/24 via-emerald-200/10 to-transparent',
    glow: '#84cc16'
  },
  {
    id: 'tutorial',
    group: 'app',
    labelKey: 'tutorial_tab_label',
    descriptionKey: 'tutorial_tab_description',
    icon: InfoIcon,
    accent: 'from-amber-300/28 via-orange-200/12 to-transparent',
    glow: '#f59e0b'
  },
  {
    id: 'about',
    group: 'app',
    labelKey: 'about',
    descriptionKey: 'configure_settings',
    icon: InfoIcon,
    accent: 'from-slate-200/24 via-white/8 to-transparent',
    glow: '#94a3b8'
  },
  {
    id: 'storage',
    group: 'app',
    labelKey: 'storage',
    descriptionKey: 'storage_description',
    icon: RefreshIcon,
    accent: 'from-cyan-300/28 via-teal-200/12 to-transparent',
    glow: '#22d3ee'
  }
] as const satisfies readonly SettingsTabMeta[]

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

interface SettingsContext {
  onClose: () => void
  setActiveTab?: (id: string) => void
}

export interface TabDef {
  id: SettingsTabId
  group: SettingsTabGroup
  label: string
  description: string
  icon: (typeof SETTINGS_TABS)[number]['icon']
  accent: string
  glow: string
}

export interface SettingsSidebarSection {
  id: SettingsTabGroup
  label: string
  tabs: TabDef[]
}

/** Stable id for the single settings content panel (all nav buttons reference via aria-controls). */
export const SETTINGS_MODAL_MAIN_PANEL_ID = 'settings-modal-main-panel'

export function settingsTabButtonId(tabId: SettingsTabId): string {
  return `settings-tab-${tabId}`
}

export function toSettingsTabId(value?: string): SettingsTabId | null {
  const matchedTab = SETTINGS_TABS.find((tab) => tab.id === value)
  return matchedTab?.id ?? null
}

const SelectorsTabWrapper = memo(function SelectorsTabWrapper({ onClose }: SettingsContext) {
  return <SelectorsTab onCloseSettings={onClose} />
})

const TutorialTabWrapper = memo(function TutorialTabWrapper({ onClose }: SettingsContext) {
  return <TutorialCenterTab onCloseSettings={onClose} />
})

const AboutTabWrapper = memo(function AboutTabWrapper({ onClose }: SettingsContext) {
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

export function buildSettingsTabDefs(t: (key: string) => string): TabDef[] {
  return SETTINGS_TABS.map((tab) => ({
    id: tab.id,
    group: tab.group,
    label: t(tab.labelKey),
    description: t(tab.descriptionKey),
    icon: tab.icon,
    accent: tab.accent,
    glow: tab.glow
  }))
}

export function buildSettingsSidebarSections(t: (key: string) => string): SettingsSidebarSection[] {
  const tabDefs = buildSettingsTabDefs(t)
  const byId = new Map(tabDefs.map((def) => [def.id, def]))

  return SETTINGS_SIDEBAR_GROUP_ORDER.map((groupId) => ({
    id: groupId,
    label: t(`settings_group_${groupId}`),
    tabs: SETTINGS_TABS.filter((tab) => tab.group === groupId).map((tab) => byId.get(tab.id)!)
  }))
}
