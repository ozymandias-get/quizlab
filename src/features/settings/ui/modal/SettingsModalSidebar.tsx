import { motion, useReducedMotion } from 'motion/react'
import { memo, type RefObject, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type SettingsSidebarSection,
  type SettingsTabId,
  type TabDef
} from './settingsTabDefinitions'

interface SettingsModalSidebarProps {
  activeTab: SettingsTabId | null
  setActiveTab: (id: string) => void
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  sidebarSections: SettingsSidebarSection[]
  sidebarWidth: number
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
  const prefersReducedMotion = useReducedMotion()
  const handleClick = useCallback(() => onSelect(tab.id), [onSelect, tab.id])

  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={handleClick}
      className={`group focus-visible:ring-ring/40 relative flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
        isActive
          ? 'border-border bg-accent text-foreground font-semibold shadow-xs'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground border-transparent bg-transparent'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="active-sidebar-indicator"
          className="bg-primary pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full"
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }
          }
        />
      )}
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon
          className={`h-4 w-4 transition-colors ${
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          }`}
        />
      </div>
      <span
        className={`block truncate text-xs font-medium tracking-wide transition-colors duration-150 ${
          isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
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
      <div className="relative flex h-full min-h-0 flex-col p-3 sm:p-4">
        <div className="relative min-h-0 flex-1">
          <div ref={sidebarScrollRef} className="custom-scrollbar h-full overflow-y-auto pr-1">
            <nav aria-label={t('settings_title')} className="flex flex-col gap-4">
              {sidebarSections.map((section) => (
                <div key={section.id} className="flex flex-col gap-1">
                  <div className="text-muted-foreground/80 mb-1 px-2 text-[10px] font-bold tracking-widest uppercase select-none">
                    {section.label}
                  </div>

                  <div className="flex flex-col gap-0.5">
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
