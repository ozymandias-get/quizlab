/**
 * The "how full is the cache" section: pressure badge, byte meter, the two
 * threshold warnings and the auto-clean switch.
 */
import { Switch } from '@app/components/ui/switch'
import { formatBytes } from '@shared/lib/formatUtils'
import { cn } from '@shared/lib/uiUtils'
import { SettingsSection } from '@shared/ui/components/primitives'

import type { TFunction } from 'i18next'
import { HardDrive, Sparkles } from 'lucide-react'
import { memo } from 'react'

import type { CachePressureLevel } from './cacheUsageSummary'
import { MAX_TOTAL_CACHE_BYTES } from './cacheUsageSummary'
import { ProgressBar } from './StorageComponents'
import { pressureLabel } from './storageUtils'

/** Pill surface for the pressure badge. Kept semantic: it encodes cache health. */
function pressureBadgeTone(level: CachePressureLevel): string {
  switch (level) {
    case 'critical':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-400'
    case 'high':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-400'
    case 'warning':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    case 'moderate':
      return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
    default:
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  }
}

/** Numeric readout beside the meter. Healthy = emerald, pressure = amber, over = destructive. */
function pressureReadoutTone(level: CachePressureLevel, isOverLimit: boolean): string {
  if (isOverLimit) return 'text-destructive'
  if (level === 'warning' || level === 'high' || level === 'critical') {
    return 'text-amber-400'
  }
  return 'text-emerald-400'
}

/**
 * One slice of the root cache distribution. Colours are semantic per source
 * (Chromium = blue, code = violet, GPU = emerald, temp = amber) so the same
 * legend dot and bar segment always identify the same cache.
 */
interface CacheDistributionSegment {
  key: string
  label: string
  size: number
  color: string
}

/** Stacked, proportional bar plus legend. Reads like a browser storage panel. */
const CacheDistribution = memo(function CacheDistribution({
  segments
}: {
  segments: CacheDistributionSegment[]
}) {
  const visible = segments.filter((segment) => segment.size > 0)
  if (visible.length === 0) return null
  const sum = visible.reduce((total, segment) => total + segment.size, 0) || 1
  const description = visible.map((s) => `${s.label} ${formatBytes(s.size)}`).join(', ')

  return (
    <div className="space-y-2.5">
      <div
        role="img"
        aria-label={description}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
      >
        {visible.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label} · ${formatBytes(segment.size)}`}
            className={cn(
              'motion-deliberate h-full transition-[width] first:rounded-l-full last:rounded-r-full',
              segment.color
            )}
            style={{ width: `${(segment.size / sum) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {visible.map((segment) => (
          <li key={segment.key} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full', segment.color)} />
            <span className="text-ql-11 text-muted-foreground truncate">{segment.label}</span>
            <span className="text-ql-11 text-muted-foreground shrink-0 font-mono tabular-nums">
              {formatBytes(segment.size)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
})

export const TotalCacheSection = memo(function TotalCacheSection({
  totalCache,
  pressureLevel,
  pressurePercentage,
  isOverLimit,
  barColor,
  segments,
  autoCleanEnabled,
  onToggleAutoClean,
  t
}: {
  totalCache: number
  pressureLevel: CachePressureLevel
  pressurePercentage: number
  isOverLimit: boolean
  barColor: string
  /** Root cache breakdown, rendered as a proportional stacked bar. */
  segments?: CacheDistributionSegment[]
  autoCleanEnabled: boolean
  onToggleAutoClean: (checked: boolean) => void
  t: TFunction
}) {
  return (
    <SettingsSection
      icon={<HardDrive className="h-4 w-4" />}
      title={t('total_cache')}
      action={
        <span
          className={cn(
            'text-ql-10 tracking-ql-label rounded-full border px-2.5 py-1 font-semibold uppercase',
            pressureBadgeTone(pressureLevel)
          )}
        >
          {pressureLabel(pressureLevel, t)} · {pressurePercentage.toFixed(0)}%
        </span>
      }
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <ProgressBar value={totalCache} max={MAX_TOTAL_CACHE_BYTES} color={barColor} />
        </div>
        <span
          className={cn(
            'text-ql-11 shrink-0 font-mono tabular-nums',
            pressureReadoutTone(pressureLevel, isOverLimit)
          )}
        >
          {formatBytes(totalCache)} / {formatBytes(MAX_TOTAL_CACHE_BYTES)}
        </span>
      </div>
      {segments && <CacheDistribution segments={segments} />}
      {isOverLimit && <p className="text-ql-11 text-destructive">{t('storage_exceeds_limit')}</p>}
      {pressureLevel === 'warning' && !isOverLimit && (
        <p className="text-ql-11 text-amber-400">{t('storage_approaching_limit')}</p>
      )}

      {/* Auto-clean toggle */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-ql-12 text-foreground font-medium">{t('cache_auto_clean')}</p>
            <p className="text-ql-11 text-muted-foreground mt-0.5">{t('cache_auto_clean_desc')}</p>
          </div>
        </div>
        <Switch
          checked={autoCleanEnabled}
          onCheckedChange={onToggleAutoClean}
          aria-label={t('cache_auto_clean')}
          className="shrink-0"
        />
      </div>
    </SettingsSection>
  )
})
