import type { RefObject } from 'react'
import { motion } from 'framer-motion'
import { TabsList, TabsTrigger } from '@ui/components/tabs'
import { SettingsIcon, ChevronRightIcon } from '@ui/components/Icons'
import { hexToRgba } from '@shared/lib/uiUtils'
import type { SettingsTabId, TabDef } from './settingsModalTabs'

interface SettingsModalSidebarProps {
  activeTab: SettingsTabId
  activeTabMeta: TabDef
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  t: (key: string) => string
  tabDefs: TabDef[]
}

export default function SettingsModalSidebar({
  activeTab,
  activeTabMeta,
  sidebarScrollRef,
  t,
  tabDefs
}: SettingsModalSidebarProps) {
  return (
    <aside className="relative w-72 shrink-0 flex flex-col border-r border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(0,0,0,0.08)_100%)] max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_22%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/[0.12] to-transparent max-[900px]:hidden" />
      <div
        className="pointer-events-none absolute -left-10 top-6 h-44 w-44 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${hexToRgba(activeTabMeta.glow, 0.22)} 0%, transparent 72%)`
        }}
      />
      <div
        className="pointer-events-none absolute -right-12 top-36 h-40 w-40 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${hexToRgba(activeTabMeta.glow, 0.12)} 0%, transparent 74%)`
        }}
      />

      <div className="relative flex h-full min-h-0 flex-col p-5 md:p-6">
        <div className="relative shrink-0 overflow-hidden rounded-[24px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02)_55%,rgba(0,0,0,0.18))] p-4 shadow-[0_20px_48px_-34px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
              style={{
                color: activeTabMeta.glow,
                borderColor: hexToRgba(activeTabMeta.glow, 0.24),
                background: `linear-gradient(160deg, ${hexToRgba(activeTabMeta.glow, 0.16)} 0%, rgba(255,255,255,0.05) 100%)`
              }}
            >
              <SettingsIcon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/42">
                {t('app_name')}
              </div>
              <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-white/92">
                {t('settings_title')}
              </h2>
            </div>
          </div>
          <motion.p
            key={activeTabMeta.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="mt-4 text-[11px] leading-5 text-white/46"
          >
            {activeTabMeta.description}
          </motion.p>
        </div>

        <div
          ref={sidebarScrollRef}
          className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar"
        >
          <TabsList className="flex h-auto flex-col items-stretch justify-start gap-2 bg-transparent p-0 max-[900px]:flex-row max-[900px]:overflow-x-auto max-[900px]:pb-1">
            {tabDefs.map((tab) => {
              const selected = activeTab === tab.id

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`
                                        group relative isolate flex w-full items-center gap-3 overflow-hidden rounded-[18px] border px-3 py-3.5 text-left outline-none backdrop-blur-xl transition-all duration-300
                                        ${
                                          selected
                                            ? 'text-white border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_16px_34px_-26px_rgba(0,0,0,0.9)]'
                                            : 'text-white/58 border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] hover:text-white/88 hover:border-white/[0.14] hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]'
                                        }
                                        max-[900px]:min-w-[220px]
                                    `}
                  style={
                    selected
                      ? {
                          background: `linear-gradient(145deg, ${hexToRgba(tab.glow, 0.14)} 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.16) 100%)`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 16px 34px -26px rgba(0,0,0,0.9), 0 0 0 1px ${hexToRgba(tab.glow, 0.08)}`
                        }
                      : undefined
                  }
                >
                  <span
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-r transition-opacity duration-300 ${tab.accent} ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'}`}
                  />
                  {selected && (
                    <motion.span
                      initial={{ x: '-140%' }}
                      animate={{ x: '160%' }}
                      transition={{
                        duration: 2.4,
                        ease: 'linear',
                        repeat: Infinity,
                        repeatDelay: 1
                      }}
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent opacity-60 blur-[1px]"
                    />
                  )}
                  <div
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 ${selected ? '' : 'group-hover:border-white/[0.14] group-hover:bg-white/[0.06]'}`}
                    style={
                      selected
                        ? {
                            color: tab.glow,
                            borderColor: hexToRgba(tab.glow, 0.24),
                            background: `linear-gradient(160deg, ${hexToRgba(tab.glow, 0.18)} 0%, ${hexToRgba(tab.glow, 0.04)} 100%)`,
                            boxShadow: `0 10px 24px -20px ${hexToRgba(tab.glow, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.14)`
                          }
                        : {
                            borderColor: 'rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)'
                          }
                    }
                  >
                    <tab.icon
                      className={`h-4 w-4 transition-colors duration-200 ${selected ? '' : 'text-white/42 group-hover:text-white/72'}`}
                    />
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold tracking-tight">
                      {tab.label}
                    </span>
                  </div>
                  <ChevronRightIcon
                    className={`relative z-10 h-4 w-4 shrink-0 transition-all duration-300 ${selected ? 'translate-x-0 text-white/70' : '-translate-x-1 text-white/14 group-hover:translate-x-0 group-hover:text-white/40'}`}
                  />
                  {selected && (
                    <motion.div
                      layoutId="active-indicator"
                      className="pointer-events-none absolute left-0 inset-y-3 w-[3px] rounded-full max-[900px]:left-3 max-[900px]:right-3 max-[900px]:top-auto max-[900px]:bottom-0 max-[900px]:h-[3px] max-[900px]:w-auto"
                      style={{
                        background: `linear-gradient(180deg, ${hexToRgba(tab.glow, 0.95)} 0%, ${hexToRgba(tab.glow, 0.35)} 100%)`,
                        boxShadow: `0 0 14px ${hexToRgba(tab.glow, 0.45)}`
                      }}
                    />
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      </div>
    </aside>
  )
}
