import { hexToRgba } from '@shared/lib/uiUtils'

import { motion } from 'motion/react'
import { memo, type RefObject, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { type SettingsSidebarSection, type SettingsTabId, type TabDef } from './settingsModalTabs'

interface SettingsModalSidebarProps {
  activeTab: SettingsTabId | null
  setActiveTab: (id: string) => void
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  sidebarSections: SettingsSidebarSection[]
  sidebarWidth: number
}

const sectionIcons: Record<string, string> = {
  workspace: '🧩',
  integration: '🔗',
  preferences: '🎨',
  app: '📦'
}

const SidebarTabButton = memo(function SidebarTabButton({
  tab,
  isActive,
  onSelect
}: {
  tab: TabDef
  isActive: boolean
  onSelect: (id: string) => void
}) {
  const Icon = tab.icon
  const activeBg = isActive
    ? {
        background: `linear-gradient(145deg, ${hexToRgba(tab.glow, 0.08)} 0%, rgba(255,255,255,0.03) 42%, rgba(0,0,0,0.1) 100%)`
      }
    : undefined

  const indicatorBg = {
    background: `linear-gradient(180deg, ${hexToRgba(tab.glow, 0.9)} 0%, ${hexToRgba(tab.glow, 0.3)} 100%)`
  }

  const handleClick = useCallback(() => onSelect(tab.id), [onSelect, tab.id])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        isActive
          ? 'border-border bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/25 hover:text-foreground border-transparent bg-transparent'
      }`}
      style={activeBg}
    >
      {isActive && (
        <motion.div
          layoutId="active-sidebar-indicator"
          className="pointer-events-none absolute inset-y-2 left-0 w-[2px] rounded-full"
          style={indicatorBg}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon
          className={`h-4 w-4 transition-colors ${
            isActive ? 'text-foreground' : 'text-foreground/65 group-hover:text-foreground/90'
          }`}
        />
      </div>
      <span
        className={`block truncate text-xs font-medium tracking-wide transition-colors duration-200 ${
          isActive ? 'text-foreground' : 'text-foreground/85 group-hover:text-foreground'
        }`}
      >
        {tab.label}
      </span>
    </button>
  )
})

const SettingsModalSidebar = memo(function SettingsModalSidebar({
  activeTab,
  setActiveTab,
  sidebarScrollRef,
  sidebarSections,
  sidebarWidth
}: SettingsModalSidebarProps) {
  const { t } = useTranslation()

  return (
    <aside
      className="border-border bg-muted/20 relative flex min-w-0 shrink-0 flex-col border-r"
      style={{ width: sidebarWidth }}
    >
      <div className="relative flex h-full min-h-0 flex-col p-4">
        <div className="relative min-h-0 flex-1">
          <div ref={sidebarScrollRef} className="custom-scrollbar h-full overflow-y-auto pr-1">
            <nav aria-label={t('settings_title')} className="flex flex-col gap-5">
              {sidebarSections.map((section) => (
                <div key={section.id} className="flex flex-col gap-1.5">
                  <div className="text-foreground/75 mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold tracking-widest uppercase select-none">
                    <span>{sectionIcons[section.id] ?? '📁'}</span>
                    <span>{section.label}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {section.tabs.map((tab) => (
                      <SidebarTabButton
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onSelect={setActiveTab}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t from-[var(--color-card)] to-transparent" />
        </div>
      </div>
    </aside>
  )
})

export default SettingsModalSidebar
