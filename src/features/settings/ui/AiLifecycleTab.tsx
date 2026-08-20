import {
  MAX_ALIVE_TABS_OPTIONS,
  SLEEP_TIMEOUT_OPTIONS,
  useAiLifecycleSettings
} from '@features/ai/hooks/useAiLifecycleSettings'

import { useAiSites } from '@app/providers/AiContext'
import { AiIcon } from '@shared/ui/components/icons/AiIcon'

import { Layers, Moon, Timer } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'
import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

const AI_LIFECYCLE_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
    <Timer className="h-5 w-5" />
  </div>
)

const NeverSleepSiteItem = memo(function NeverSleepSiteItem({
  site,
  isNeverSleep,
  onToggle
}: {
  site: { id: string; displayName?: string }
  isNeverSleep: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className="border-border bg-card hover:bg-muted/60 flex items-center gap-3 rounded-xl border p-3 transition-colors">
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <AiIcon modelKey={site.id} className="h-4 w-4" />
      </div>
      <span className="text-foreground grow truncate text-xs font-medium">
        {site.displayName || site.id}
      </span>
      <SettingsToggleSwitch checked={isNeverSleep} onChange={() => onToggle(site.id)} size="sm" />
    </div>
  )
})
NeverSleepSiteItem.displayName = 'NeverSleepSiteItem'

const AiLifecycleTab = memo(() => {
  const { t } = useTranslation()
  const aiSites = useAiSites()
  const {
    maxAliveTabs,
    sleepTimeoutMs,
    neverSleepSiteIds,
    setMaxAliveTabs,
    setSleepTimeoutMs,
    toggleNeverSleepSite
  } = useAiLifecycleSettings()

  const allSiteEntries = useMemo(() => Object.values(aiSites), [aiSites])

  const sleepLabel = useMemo(() => {
    const matched = SLEEP_TIMEOUT_OPTIONS.find((o) => o.value === sleepTimeoutMs)
    return matched ? t(matched.labelKey) : t('sleep_1m')
  }, [sleepTimeoutMs, t])

  return (
    <div className="space-y-6">
      <SettingsTabIntro icon={AI_LIFECYCLE_ICON} description={t('ai_lifecycle_description')} />

      {/* Max Alive Tabs */}
      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4 shadow-xs">
          <div className="border-primary/20 bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-foreground text-xs leading-tight font-semibold">
              {t('max_alive_tabs')}
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {t('max_alive_tabs_description')}
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-1">
          {MAX_ALIVE_TABS_OPTIONS.map((num) => (
            <button
              type="button"
              key={num}
              onClick={() => setMaxAliveTabs(num)}
              className={`focus-visible:ring-ring/40 motion-slow flex-1 rounded-xl py-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none ${
                maxAliveTabs === num
                  ? 'border-primary/30 bg-primary/10 text-primary border font-semibold shadow-xs'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground border'
              } `}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep Timeout */}
      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4 shadow-xs">
          <div className="border-primary/20 bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            <Timer className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-foreground text-xs leading-tight font-semibold">
              {t('sleep_timeout')}
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {t('sleep_timeout_description')}
            </p>
          </div>
          <span className="text-muted-foreground shrink-0 text-xs font-medium">{sleepLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 px-1">
          {SLEEP_TIMEOUT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setSleepTimeoutMs(option.value)}
              className={`focus-visible:ring-ring/40 motion-slow rounded-xl py-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none ${
                sleepTimeoutMs === option.value
                  ? 'border-primary/30 bg-primary/10 text-primary border font-semibold shadow-xs'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground border'
              } `}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Never Sleep Sites */}
      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4 shadow-xs">
          <div className="border-primary/20 bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            <Moon className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-foreground text-xs leading-tight font-semibold">
              {t('never_sleep_sites')}
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {t('never_sleep_sites_description')}
            </p>
          </div>
        </div>

        <div className="space-y-1 px-1">
          {allSiteEntries.map((site) => (
            <NeverSleepSiteItem
              key={site.id}
              site={site}
              isNeverSleep={neverSleepSiteIds.includes(site.id)}
              onToggle={toggleNeverSleepSite}
            />
          ))}
        </div>
      </div>
    </div>
  )
})

AiLifecycleTab.displayName = 'AiLifecycleTab'

export default AiLifecycleTab
