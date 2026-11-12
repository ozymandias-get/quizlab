import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeftRight,
  BellRing,
  Bot,
  HardDrive,
  Info,
  Keyboard,
  Languages,
  LayoutGrid,
  MessagesSquare,
  MousePointerClick,
  Palette,
  PanelBottom,
  WandSparkles
} from 'lucide-react'

export const SETTINGS_SIDEBAR_GROUP_ORDER = [
  'workspace',
  'integration',
  'preferences',
  'app'
] as const

type SettingsTabGroup = (typeof SETTINGS_SIDEBAR_GROUP_ORDER)[number]

interface SettingsTabMeta {
  id: string
  group: SettingsTabGroup
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
  accent: string
  glow: string
}

export const SETTINGS_TABS = [
  {
    id: 'prompts',
    group: 'workspace',
    labelKey: 'prompts',
    descriptionKey: 'prompts_description',
    icon: WandSparkles,
    accent: 'from-amber-300/28 via-orange-200/12 to-transparent',
    glow: '#f59e0b'
  },
  {
    id: 'models',
    group: 'workspace',
    labelKey: 'models',
    descriptionKey: 'models_description',
    icon: Bot,
    accent: 'from-sky-300/28 via-cyan-200/12 to-transparent',
    glow: '#38bdf8'
  },
  {
    id: 'sites',
    group: 'workspace',
    labelKey: 'ai_sites',
    descriptionKey: 'sites_description',
    icon: LayoutGrid,
    accent: 'from-emerald-300/28 via-teal-200/12 to-transparent',
    glow: '#34d399'
  },
  {
    id: 'ai-lifecycle',
    group: 'workspace',
    labelKey: 'ai_lifecycle',
    descriptionKey: 'ai_lifecycle_description',
    icon: Activity,
    accent: 'from-violet-300/28 via-purple-200/12 to-transparent',
    glow: '#8b5cf6'
  },
  {
    id: 'text-input-mode',
    group: 'workspace',
    labelKey: 'text_input_mode',
    descriptionKey: 'text_input_mode_description',
    icon: Keyboard,
    accent: 'from-orange-300/28 via-amber-200/12 to-transparent',
    glow: '#f97316'
  },
  {
    id: 'api-chat',
    group: 'integration',
    labelKey: 'api_chat_settings_title',
    descriptionKey: 'api_chat_settings_desc',
    icon: MessagesSquare,
    accent: 'from-amber-300/28 via-amber-200/12 to-transparent',
    glow: '#f59e0b'
  },
  {
    id: 'site-sessions',
    group: 'integration',
    labelKey: 'ws_title',
    descriptionKey: 'ws_description',
    icon: ArrowLeftRight,
    accent: 'from-violet-300/28 via-indigo-200/12 to-transparent',
    glow: '#8b5cf6'
  },
  {
    id: 'selectors',
    group: 'integration',
    labelKey: 'selectors',
    descriptionKey: 'selectors_description_simple',
    icon: MousePointerClick,
    accent: 'from-white/28 via-white/12 to-transparent',
    glow: '#d4d4d8'
  },
  {
    id: 'notifications',
    group: 'preferences',
    labelKey: 'notifications',
    descriptionKey: 'notifications_description',
    icon: BellRing,
    accent: 'from-emerald-300/28 via-teal-200/12 to-transparent',
    glow: '#34d399'
  },
  {
    id: 'appearance',
    group: 'preferences',
    labelKey: 'appearance',
    descriptionKey: 'appearance_description',
    icon: Palette,
    accent: 'from-rose-300/28 via-red-200/10 to-transparent',
    glow: '#fb7185'
  },
  {
    id: 'bottom-bar',
    group: 'preferences',
    labelKey: 'bottom_bar',
    descriptionKey: 'bottom_bar_description',
    icon: PanelBottom,
    accent: 'from-sky-300/28 via-cyan-200/12 to-transparent',
    glow: '#38bdf8'
  },
  {
    id: 'language',
    group: 'preferences',
    labelKey: 'language',
    descriptionKey: 'language_description',
    icon: Languages,
    accent: 'from-lime-300/24 via-emerald-200/10 to-transparent',
    glow: '#84cc16'
  },
  {
    id: 'about',
    group: 'app',
    labelKey: 'about',
    descriptionKey: 'configure_settings',
    icon: Info,
    accent: 'from-slate-200/24 via-white/8 to-transparent',
    glow: '#94a3b8'
  },
  {
    id: 'storage',
    group: 'app',
    labelKey: 'storage',
    descriptionKey: 'storage_description',
    icon: HardDrive,
    accent: 'from-cyan-300/28 via-teal-200/12 to-transparent',
    glow: '#22d3ee'
  }
] as const satisfies readonly SettingsTabMeta[]

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export interface SettingsContext {
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

export const SETTINGS_MODAL_MAIN_PANEL_ID = 'settings-modal-main-panel'

export function toSettingsTabId(value?: string): SettingsTabId | null {
  const matchedTab = SETTINGS_TABS.find((tab) => tab.id === value)
  return matchedTab?.id ?? null
}
