import { hexToRgba } from '@shared/lib/uiUtils'
import { SurfaceCard } from '@shared/ui/components/primitives'
import { SettingsIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo, type RefObject, useCallback } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  type SettingsSidebarSection,
  type SettingsTabGroup
} from './settingsModalTabs'

interface SettingsModalSidebarProps {
  selectedGroup: SettingsTabGroup | null
  selectGroup: (group: SettingsTabGroup) => void
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  sidebarSections: SettingsSidebarSection[]
  t: (key: string) => string
}

const SettingsModalSidebar = memo(function SettingsModalSidebar({
  selectedGroup,
  selectGroup,
  sidebarScrollRef,
  sidebarSections,
  t
}: SettingsModalSidebarProps) {
  const isQuickActive = selectedGroup === QUICK_SETTINGS_GROUP
  const handleQuickClick = useCallback(() => selectGroup(QUICK_SETTINGS_GROUP), [selectGroup])
  const handleSectionClick = useCallback(
    (sectionId: SettingsTabGroup) => () => selectGroup(sectionId),
    [selectGroup]
  )

  return (
    <aside className="border-border bg-muted/20 relative flex w-[280px] shrink-0 flex-col border-r max-[900px]:hidden">
      <div className="relative flex h-full min-h-0 flex-col p-4">
        <SurfaceCard
          variant="default"
          className="relative mb-4 shrink-0 overflow-hidden rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="border-border bg-card text-muted-foreground relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <SettingsIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="border-border bg-card text-muted-foreground text-ql-10 inline-flex items-center rounded-full border px-2 py-0.5 font-medium tracking-wider">
                {t('app_name')}
              </div>
              <h2 className="text-foreground mt-1.5 text-base leading-none font-semibold tracking-tight">
                {t('settings_title')}
              </h2>
            </div>
          </div>
        </SurfaceCard>

        <div className="relative min-h-0 flex-1">
          <div ref={sidebarScrollRef} className="custom-scrollbar h-full overflow-y-auto pr-1">
            <nav aria-label={t('settings_title')} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleQuickClick}
                className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative isolate overflow-hidden rounded-lg border p-3.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isQuickActive
                    ? 'border-ring/30 bg-accent'
                    : 'border-border hover:border-border hover:bg-accent/50 bg-transparent'
                }`}
                style={
                  isQuickActive
                    ? {
                        background:
                          'linear-gradient(145deg, oklch(0.74 0.15 85 / 0.08) 0%, oklch(1 0 0 / 0.03) 42%, oklch(0 0 0 / 0.1) 100%)'
                      }
                    : undefined
                }
              >
                {isQuickActive && (
                  <motion.div
                    layoutId="active-sidebar-indicator"
                    className="pointer-events-none absolute inset-y-2 left-0 w-[2px] rounded-full"
                    style={{
                      background:
                        'linear-gradient(180deg, oklch(0.74 0.15 85 / 0.9) 0%, oklch(0.74 0.15 85 / 0.3) 100%)'
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span
                  className={`block text-xs font-semibold tracking-widest uppercase transition-colors duration-200 ${
                    isQuickActive
                      ? 'text-foreground'
                      : 'text-muted-foreground group-hover:text-foreground/70'
                  }`}
                >
                  {t('quick_settings')}
                </span>
              </button>

              <div className="bg-border my-1 h-px" />

              {sidebarSections.map((section) => {
                const isActive = selectedGroup === section.id
                const firstGlow = section.tabs[0]?.glow ?? '#94a3b8'

                return (
                  <button
                    type="button"
                    key={section.id}
                    onClick={handleSectionClick(section.id)}
                    className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative isolate overflow-hidden rounded-lg border p-3.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      isActive
                        ? 'border-ring/30 bg-accent'
                        : 'border-border hover:border-border hover:bg-accent/50 bg-transparent'
                    }`}
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(145deg, ${hexToRgba(firstGlow, 0.08)} 0%, rgba(255,255,255,0.03) 42%, rgba(0,0,0,0.1) 100%)`
                          }
                        : undefined
                    }
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-sidebar-indicator"
                        className="pointer-events-none absolute inset-y-2 left-0 w-[2px] rounded-full"
                        style={{
                          background: `linear-gradient(180deg, ${hexToRgba(firstGlow, 0.9)} 0%, ${hexToRgba(firstGlow, 0.3)} 100%)`
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span
                      className={`block text-xs font-semibold tracking-widest uppercase transition-colors duration-200 ${
                        isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground group-hover:text-foreground/70'
                      }`}
                    >
                      {section.label}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t from-[var(--color-card)] to-transparent" />
        </div>
      </div>
    </aside>
  )
})

export default SettingsModalSidebar
