import { MAX_ALIVE_TABS_OPTIONS, SLEEP_TIMEOUT_OPTIONS, useAiLifecycleSettings } from '@features/ai'

import { useAiSites } from '@app/providers/ai-context'
import { cn } from '@shared/lib/uiUtils'
import { AiIcon } from '@shared/ui/components/icons/AiIcon'
import {
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro,
  TabPill
} from '@shared/ui/components/primitives'

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
        isNeverSleep ? 'border-ring/50 bg-accent/30' : 'border-border/60 bg-card hover:bg-muted/50'
      )}
    >
      <span
        aria-hidden
        className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
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
    <div className="space-y-6 pb-4">
      <SettingsTabIntro icon={AI_LIFECYCLE_ICON} description={t('ai_lifecycle_description')} />

      {/* Max Alive Tabs */}
      <SettingsSection
        icon={<Layers className="h-4 w-4" />}
        title={t('max_alive_tabs')}
        detail={t('max_alive_tabs_description')}
      >
        <div className="grid grid-cols-5 gap-2" role="tablist" aria-label={t('max_alive_tabs')}>
          {MAX_ALIVE_TABS_OPTIONS.map((num) => (
            <TabPill
              key={num}
              isActive={maxAliveTabs === num}
              onClick={() => setMaxAliveTabs(num)}
              aria-label={t('max_alive_tabs')}
              className="w-full justify-center rounded-lg"
            >
              <span className="text-ql-12 font-medium tabular-nums">{num}</span>
            </TabPill>
          ))}
        </div>
      </SettingsSection>

      {/* Sleep Timeout */}
      <SettingsSection
        icon={<Timer className="h-4 w-4" />}
        title={t('sleep_timeout')}
        detail={t('sleep_timeout_description')}
        action={
          <span className="bg-muted text-muted-foreground text-ql-11 rounded-full px-2.5 py-1 font-medium">
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
