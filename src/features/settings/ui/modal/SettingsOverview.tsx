import { hexToRgba } from '@shared/lib/uiUtils'

import { memo, useCallback } from 'react'

import type { SettingsSidebarSection, TabDef } from './settingsModalTabs'

interface SettingsOverviewProps {
  section: SettingsSidebarSection
  setActiveTab: (id: string) => void
  t: (key: string) => string
}

function SettingsOverview({ section, setActiveTab, t }: SettingsOverviewProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <h3 className="text-foreground text-lg font-semibold tracking-tight">{section.label}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t('settings_overview_description')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {section.tabs.map((tab) => (
          <OverviewCard key={tab.id} tab={tab} setActiveTab={setActiveTab} />
        ))}
      </div>
    </div>
  )
}

function OverviewCard({ tab, setActiveTab }: { tab: TabDef; setActiveTab: (id: string) => void }) {
  const handleClick = useCallback(() => setActiveTab(tab.id), [setActiveTab, tab.id])
  return (
    <button
      type="button"
      onClick={handleClick}
      className="group border-border bg-card hover:border-ring/30 hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-offset-background relative isolate overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(tab.glow, 0.06)} 0%, transparent 60%)`
        }}
      />
      <div className="relative z-10 flex flex-col gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg border"
          style={{
            color: tab.glow,
            borderColor: hexToRgba(tab.glow, 0.2),
            background: `linear-gradient(160deg, ${hexToRgba(tab.glow, 0.14)} 0%, ${hexToRgba(tab.glow, 0.04)} 100%)`
          }}
        >
          <tab.icon className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <span className="text-foreground/90 block text-xs font-semibold">{tab.label}</span>
          <span className="text-muted-foreground text-ql-11 block leading-relaxed">
            {tab.description}
          </span>
        </div>
      </div>
    </button>
  )
}

export default memo(SettingsOverview)
