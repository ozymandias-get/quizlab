import React, { lazy } from 'react'
import {
  SettingsIcon,
  LanguageIcon,
  InfoIcon,
  GridIcon,
  EyeIcon,
  MagicWandIcon,
  SelectorIcon,
  GeminiIcon
} from '@ui/components/Icons'
import { useSettings } from '../../hooks/useSettings'

const LanguageTab = lazy(() => import('../LanguageTab'))
const AboutTab = lazy(() => import('../AboutTab'))
const SitesTab = lazy(() => import('../SitesTab'))
const ModelsTab = lazy(() => import('../ModelsTab'))
const AppearanceTab = lazy(() => import('../AppearanceTab'))
const SelectorsTab = lazy(() => import('../SelectorsTab'))
const GeminiWebSessionTab = lazy(() => import('../GeminiWebSessionTab'))
const PromptsTab = lazy(() => import('../PromptsTab'))

interface SettingsTabMeta {
  id: string
  labelKey: string
  descriptionKey: string
  icon: typeof SettingsIcon
  accent: string
  glow: string
  fallbackLabel?: string
}

const SETTINGS_TABS = [
  {
    id: 'prompts',
    labelKey: 'prompts',
    descriptionKey: 'prompts_description',
    icon: MagicWandIcon,
    accent: 'from-amber-300/28 via-orange-200/12 to-transparent',
    glow: '#f59e0b'
  },
  {
    id: 'models',
    labelKey: 'models',
    descriptionKey: 'models_description',
    icon: GridIcon,
    accent: 'from-sky-300/28 via-cyan-200/12 to-transparent',
    glow: '#38bdf8'
  },
  {
    id: 'sites',
    labelKey: 'ai_sites',
    fallbackLabel: 'Siteler',
    descriptionKey: 'sites_description',
    icon: GridIcon,
    accent: 'from-emerald-300/28 via-teal-200/12 to-transparent',
    glow: '#34d399'
  },
  {
    id: 'gemini-web',
    labelKey: 'gws_title',
    descriptionKey: 'gws_state_authenticated',
    icon: GeminiIcon,
    accent: 'from-violet-300/28 via-indigo-200/12 to-transparent',
    glow: '#8b5cf6'
  },
  {
    id: 'selectors',
    labelKey: 'selectors',
    descriptionKey: 'selectors_description_simple',
    icon: SelectorIcon,
    accent: 'from-white/28 via-white/12 to-transparent',
    glow: '#d4d4d8'
  },
  {
    id: 'appearance',
    labelKey: 'appearance',
    descriptionKey: 'appearance_description',
    icon: EyeIcon,
    accent: 'from-rose-300/28 via-red-200/10 to-transparent',
    glow: '#fb7185'
  },
  {
    id: 'language',
    labelKey: 'language',
    descriptionKey: 'language_description',
    icon: LanguageIcon,
    accent: 'from-lime-300/24 via-emerald-200/10 to-transparent',
    glow: '#84cc16'
  },
  {
    id: 'about',
    labelKey: 'about',
    descriptionKey: 'configure_settings',
    icon: InfoIcon,
    accent: 'from-slate-200/24 via-white/8 to-transparent',
    glow: '#94a3b8'
  }
] as const satisfies readonly SettingsTabMeta[]

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']
export type SettingsState = ReturnType<typeof useSettings>

interface SettingsContext {
  onClose: () => void
  settings: SettingsState
}

export interface TabDef {
  id: SettingsTabId
  label: string
  description: string
  icon: (typeof SETTINGS_TABS)[number]['icon']
  accent: string
  glow: string
}

const DEFAULT_SETTINGS_TAB: SettingsTabId = 'prompts'

export function toSettingsTabId(value?: string): SettingsTabId {
  const matchedTab = SETTINGS_TABS.find((tab) => tab.id === value)
  return matchedTab?.id ?? DEFAULT_SETTINGS_TAB
}

export const SETTINGS_TAB_RENDERERS: Record<
  SettingsTabId,
  (context: SettingsContext) => React.ReactNode
> = {
  prompts: () => <PromptsTab />,
  models: () => <ModelsTab />,
  sites: () => <SitesTab />,
  'gemini-web': () => <GeminiWebSessionTab />,
  selectors: ({ onClose }) => <SelectorsTab onCloseSettings={onClose} />,
  appearance: () => <AppearanceTab />,
  language: () => <LanguageTab />,
  about: ({ onClose, settings }) => (
    <AboutTab
      appVersion={settings.appVersion}
      updateStatus={settings.updateStatus}
      updateInfo={settings.updateInfo}
      checkForUpdates={settings.checkForUpdates}
      openReleasesPage={settings.openReleasesPage}
      onClose={onClose}
    />
  )
}

export function buildSettingsTabDefs(t: (key: string) => string): TabDef[] {
  return SETTINGS_TABS.map((tab) => ({
    id: tab.id,
    label:
      t(tab.labelKey) || ('fallbackLabel' in tab ? tab.fallbackLabel : undefined) || tab.labelKey,
    description: t(tab.descriptionKey),
    icon: tab.icon,
    accent: tab.accent,
    glow: tab.glow
  }))
}
