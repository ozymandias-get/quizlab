import {
  MAX_ALIVE_TABS_MAX,
  MAX_ALIVE_TABS_MIN,
  SLEEP_TIMEOUT_OPTIONS,
  useAiLifecycleSettings
} from '@features/ai'

import { useAiSites } from '@app/providers/ai-context'
import { cn } from '@shared/lib/uiUtils'
import { AiIcon } from '@shared/ui/components/icons/AiIcon'
import {
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro,
  TabPill
} from '@shared/ui/components/primitives'
import Slider from '@ui/components/Slider'

import { Layers, Moon, Timer } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

const AI_LIFECYCLE_ICON = (
  <SettingsTabIcon>
    <Timer className="h-5 w-5" />
  </SettingsTabIcon>
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
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        isNeverSleep
          ? 'border-white/[0.09] bg-white/[0.03]'
          : 'border-white/[0.07] bg-transparent hover:bg-white/[0.03]'
      )}
    >
      <span
        aria-hidden
        className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
      >
        <AiIcon modelKey={site.id} className="h-4 w-4" />
      </span>
      <span className="text-ql-12 text-foreground grow truncate font-medium">
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
    <div className="space-y-4 pb-4">
      <SettingsTabIntro icon={AI_LIFECYCLE_ICON} description={t('ai_lifecycle_description')} />

      {/* Max Alive Tabs */}
      <SettingsSection
        icon={<Layers className="h-4 w-4" />}
        title={t('max_alive_tabs')}
        detail={t('max_alive_tabs_description')}
      >
        <div className="rounded-xl border border-white/[0.07] bg-zinc-950/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-ql-12 text-foreground font-medium">
              {t('max_alive_tabs_value', { count: maxAliveTabs })}
            </span>
            <span className="text-ql-11 text-muted-foreground font-mono tabular-nums">
              {maxAliveTabs} / {MAX_ALIVE_TABS_MAX}
            </span>
          </div>
          <Slider
            min={MAX_ALIVE_TABS_MIN}
            max={MAX_ALIVE_TABS_MAX}
            step={1}
            value={[maxAliveTabs]}
            onValueChange={(value) => setMaxAliveTabs(value[0] ?? MAX_ALIVE_TABS_MIN)}
            aria-label={t('max_alive_tabs')}
          />
          <div className="text-ql-10 mt-2.5 flex items-center justify-between gap-2 font-medium">
            <span className="text-emerald-400">{t('max_alive_low_ram')}</span>
            <span className="text-amber-400">{t('max_alive_balanced')}</span>
            <span className="text-sky-400">{t('max_alive_performance')}</span>
          </div>
        </div>
      </SettingsSection>

      {/* Sleep Timeout */}
      <SettingsSection
        icon={<Timer className="h-4 w-4" />}
        title={t('sleep_timeout')}
        detail={t('sleep_timeout_description')}
        action={
          <span className="text-muted-foreground text-ql-11 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 font-medium">
            {sleepLabel}
          </span>
        }
      >
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t('sleep_timeout')}>
          {SLEEP_TIMEOUT_OPTIONS.map((option) => (
            <TabPill
              key={option.value}
              isActive={sleepTimeoutMs === option.value}
              onClick={() => setSleepTimeoutMs(option.value)}
              aria-label={t(option.labelKey)}
              className="w-full justify-center rounded-lg"
            >
              <span className="text-ql-12 font-medium">{t(option.labelKey)}</span>
            </TabPill>
          ))}
        </div>
      </SettingsSection>

      {/* Never Sleep Sites */}
      <SettingsSection
        icon={<Moon className="h-4 w-4" />}
        title={t('never_sleep_sites')}
        detail={t('never_sleep_sites_description')}
      >
        <div className="space-y-2">
          {allSiteEntries.map((site) => (
            <NeverSleepSiteItem
              key={site.id}
              site={site}
              isNeverSleep={neverSleepSiteIds.includes(site.id)}
              onToggle={toggleNeverSleepSite}
            />
          ))}
        </div>
      </SettingsSection>
    </div>
  )
})

AiLifecycleTab.displayName = 'AiLifecycleTab'

export default AiLifecycleTab
