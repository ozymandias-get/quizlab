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
  <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-purple-500/20 p-2.5 text-violet-400">
    <Timer className="h-5 w-5" />
  </div>
)

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
      <SettingsTabIntro
        icon={AI_LIFECYCLE_ICON}
        eyebrow={t('ai_settings')}
        title={t('ai_lifecycle')}
        description={t('ai_lifecycle_description')}
      />

      {/* Max Alive Tabs */}
      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/15 text-blue-400">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-xs leading-tight font-semibold text-white/88">
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
              className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all duration-200 ${
                maxAliveTabs === num
                  ? 'border border-violet-500/30 bg-violet-500/20 text-violet-300 shadow-lg shadow-violet-500/10'
                  : 'bg-card border-border border text-white/45 hover:bg-white/[0.06] hover:text-white/65'
              } `}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep Timeout */}
      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/15 text-amber-400">
            <Timer className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-xs leading-tight font-semibold text-white/88">
              {t('sleep_timeout')}
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {t('sleep_timeout_description')}
            </p>
          </div>
          <span className="text-muted-foreground/70 shrink-0 text-xs">{sleepLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 px-1">
          {SLEEP_TIMEOUT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setSleepTimeoutMs(option.value)}
              className={`rounded-xl py-2.5 text-xs font-medium transition-all duration-200 ${
                sleepTimeoutMs === option.value
                  ? 'border border-amber-500/30 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'bg-card border-border border text-white/45 hover:bg-white/[0.06] hover:text-white/65'
              } `}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Never Sleep Sites */}
      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/15 text-emerald-400">
            <Moon className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-xs leading-tight font-semibold text-white/88">
              {t('never_sleep_sites')}
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {t('never_sleep_sites_description')}
            </p>
          </div>
        </div>

        <div className="space-y-1 px-1">
          {allSiteEntries.map((site) => {
            const isNeverSleep = neverSleepSiteIds.includes(site.id)
            return (
              <div
                key={site.id}
                className="border-border bg-card flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                  <AiIcon modelKey={site.id} className="h-4 w-4" />
                </div>
                <span className="text-muted-foreground/80 grow truncate text-xs">
                  {site.displayName || site.id}
                </span>
                <SettingsToggleSwitch
                  checked={isNeverSleep}
                  onChange={() => toggleNeverSleepSite(site.id)}
                  size="sm"
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

AiLifecycleTab.displayName = 'AiLifecycleTab'

export default AiLifecycleTab
