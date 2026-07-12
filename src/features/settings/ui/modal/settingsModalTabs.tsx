import { type ComponentType, memo } from 'react'

import { useSettings } from '../../hooks/useSettings'
import {
  AboutTabWrapper,
  SelectorsTabWrapper,
  SETTINGS_TAB_COMPONENTS,
  TutorialTabWrapper
} from './settingsTabComponents'
import {
  SETTINGS_MODAL_MAIN_PANEL_ID,
  SETTINGS_SIDEBAR_GROUP_ORDER,
  SETTINGS_TABS,
  type SettingsContext,
  type SettingsSidebarSection,
  settingsTabButtonId,
  type SettingsTabGroup,
  type SettingsTabId,
  type TabDef,
  toSettingsTabId
} from './settingsTabDefinitions'

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
