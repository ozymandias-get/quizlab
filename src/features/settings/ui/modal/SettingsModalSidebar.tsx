import { memo, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsNavItem from '../shared/SettingsNavItem'
import { type SettingsSidebarSection, type SettingsTabId } from './settingsTabDefinitions'

interface SettingsModalSidebarProps {
  activeTab: SettingsTabId | null
  setActiveTab: (id: string) => void
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  sidebarSections: SettingsSidebarSection[]
  sidebarWidth: number
}

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
                  <div className="text-muted-foreground/80 text-ql-10 mb-1 px-2 font-bold tracking-widest uppercase select-none">
                    {section.label}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    {section.tabs.map((tab) => (
                      <SettingsNavItem
                        key={tab.id}
                        label={tab.label}
                        icon={tab.icon}
                        isActive={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
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
