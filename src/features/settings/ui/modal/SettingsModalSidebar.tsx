import { memo, type RefObject, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsNavItem from '../shared/SettingsNavItem'
import { type SettingsSidebarSection, type SettingsTabId } from './settingsTabDefinitions'

interface SettingsModalSidebarProps {
  activeTab: SettingsTabId | null
  setActiveTab: (id: string) => void
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  sidebarSections: SettingsSidebarSection[]
  sidebarWidth: number
  isCompact: boolean
}

const SettingsModalSidebar = memo(function SettingsModalSidebar({
  activeTab,
  setActiveTab,
  sidebarScrollRef,
  sidebarSections,
  sidebarWidth,
  isCompact
}: SettingsModalSidebarProps) {
  const { t } = useTranslation()
  const [hasMoreBelow, setHasMoreBelow] = useState(false)

  /**
   * The bottom fade is a scroll cue, so it may only appear while there is
   * something left to scroll to. At a tall window the whole nav fits
   * (`scrollHeight === clientHeight`) and an unconditional fade dimmed the last
   * row even though nothing was hidden behind it.
   */
  const updateOverflowState = useCallback(() => {
    const el = sidebarScrollRef.current
    if (!el) {
      setHasMoreBelow(false)
      return
    }

    setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  }, [sidebarScrollRef])

  useEffect(() => {
    const el = sidebarScrollRef.current
    if (!el) return

    updateOverflowState()
    el.addEventListener('scroll', updateOverflowState, { passive: true })

    // Watching the nav (a child) as well as the viewport keeps the cue correct
    // when the compact rail or a section list changes the content height.
    const observer = new ResizeObserver(updateOverflowState)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)

    return () => {
      el.removeEventListener('scroll', updateOverflowState)
      observer.disconnect()
    }
  }, [sidebarScrollRef, updateOverflowState, isCompact])

  return (
    <aside
      className="relative flex min-w-0 shrink-0 flex-col border-r border-white/[0.07] bg-zinc-950/40"
      style={{ width: sidebarWidth }}
    >
      <div
        className={`relative flex h-full min-h-0 flex-col ${isCompact ? 'p-1.5' : 'p-3 sm:p-4'}`}
      >
        <div className="relative min-h-0 flex-1">
          <div
            ref={sidebarScrollRef}
            className={`custom-scrollbar h-full overflow-y-auto ${isCompact ? '' : 'pr-1'}`}
          >
            <nav
              aria-label={t('settings_title')}
              className={`flex flex-col ${isCompact ? 'gap-2' : 'gap-5'}`}
            >
              {sidebarSections.map((section) => (
                <div
                  key={section.id}
                  className={`flex flex-col ${isCompact ? 'gap-1' : 'gap-1.5'}`}
                >
                  {!isCompact && (
                    <div className="text-muted-foreground text-ql-10 tracking-ql-label px-2 leading-tight font-semibold uppercase select-none">
                      {section.label}
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5">
                    {section.tabs.map((tab) => (
                      <SettingsNavItem
                        key={tab.id}
                        label={tab.label}
                        icon={tab.icon}
                        tabId={tab.id}
                        isActive={activeTab === tab.id}
                        onSelect={setActiveTab}
                        compact={isCompact}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          <div
            aria-hidden
            className={`motion-normal from-background/80 pointer-events-none absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t to-transparent transition-opacity ${
              hasMoreBelow ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </aside>
  )
})

export default SettingsModalSidebar
