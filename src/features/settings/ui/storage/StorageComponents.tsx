import { formatBytes } from '@shared/lib/formatUtils'
import { cn } from '@shared/lib/uiUtils'

import type { TFunction } from 'i18next'
import i18next from 'i18next'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { memo } from 'react'

import { pressureLabel } from './storageUtils'

/**
 * The per-row "clear this partition" glyph repeats down the whole list, so it
 * hides at rest and fades in on hover/focus instead of forming a wall of
 * identical trash icons. It lives on a named group (`group/clear`) so keyboard
 * focus on the button itself reveals it — the row itself is not focusable.
 * Status affordances (the category dot and its badge) encode state, so they
 * stay visible at rest.
 */
const HOVER_AFFORDANCE =
  'opacity-0 transition-opacity group-hover/clear:opacity-100 group-focus-visible/clear:opacity-100 motion-reduce:opacity-100'

/** Alert banner shape: a sibling of the section cards, so it carries their radius. */
const BANNER_SURFACE = 'rounded-2xl border p-4'

/** Alert banner tone. Kept semantic: sky = informational, amber = warning. */
const TONE_INFO = 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400'
const TONE_WARN = 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'

function appLocale(): 'tr-TR' | 'en-US' {
  return i18next.language === 'tr' ? 'tr-TR' : 'en-US'
}

export const ProgressBar = memo(function ProgressBar({
  value,
  max,
  color
}: {
  value: number
  max: number
  color: string
}) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
  return (
    <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
      <div
        className={cn('motion-deliberate h-full rounded-full transition-transform', color)}
        style={{ transform: `scaleX(${pct / 100})`, transformOrigin: 'left' }}
      />
    </div>
  )
})

export const RootCacheRow = memo(function RootCacheRow({
  label,
  size
}: {
  label: string
  size: number
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ql-12 text-foreground min-w-0 truncate">{label}</span>
      <span className="text-ql-12 text-muted-foreground shrink-0 font-mono tabular-nums">
        {formatBytes(size)}
      </span>
    </div>
  )
})

export const PartitionRow = memo(function PartitionRow({
  partitionKey,
  label,
  size,
  category,
  lastActive,
  onClear,
  t
}: {
  partitionKey: string
  label: string
  size: number
  category?: 'active' | 'passive' | 'cold'
  lastActive?: number | null
  onClear?: () => void
  t: TFunction
}) {
  const dotColor =
    category === 'active'
      ? 'bg-emerald-500'
      : category === 'passive'
        ? 'bg-amber-500'
        : 'bg-slate-400'
  const categoryLabel =
    category === 'active'
      ? t('storage_category_active')
      : category === 'passive'
        ? t('storage_category_passive')
        : category === 'cold'
          ? t('storage_category_cold')
          : null
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            category ? dotColor : 'bg-muted-foreground'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ql-12 text-foreground block truncate font-medium">{label}</span>
            {category && categoryLabel && (
              <span
                className={cn(
                  'text-ql-10 shrink-0 rounded-full px-2 py-0.5 font-medium',
                  category === 'active'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : category === 'passive'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {categoryLabel}
              </span>
            )}
          </div>
          <span className="text-ql-11 text-muted-foreground block truncate font-mono">
            {partitionKey}
          </span>
          {lastActive && (
            <span className="text-ql-11 text-muted-foreground block truncate">
              {t('storage_last_active', {
                date: new Date(lastActive).toLocaleDateString(appLocale())
              })}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-ql-12 text-muted-foreground font-mono tabular-nums">
          {formatBytes(size)}
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="group/clear text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground rounded-lg p-1.5 transition-colors"
            title={t('partition_clear_title')}
            aria-label={t('partition_clear_aria', { name: label })}
          >
            <svg
              className={HOVER_AFFORDANCE}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
})

export const SmartRecommendationBanner = memo(function SmartRecommendationBanner({
  pressureLevel,
  pressurePercentage,
  recommendation,
  onAction,
  t
}: {
  pressureLevel: string
  pressurePercentage: number
  recommendation: {
    action: string
    reason: string
    targetPartitions: string[]
    estimatedFreeBytes: number
  } | null
  onAction?: (action: string) => void
  t: TFunction
}) {
  if (!recommendation || recommendation.action === 'none') {
    if (pressureLevel === 'warning' || pressureLevel === 'high' || pressureLevel === 'critical') {
      return (
        <div className={cn(BANNER_SURFACE, TONE_WARN)}>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="bg-background/40 flex size-8 shrink-0 items-center justify-center rounded-lg"
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-ql-12 font-semibold">
                {t('storage_pressure_status', {
                  level: pressureLabel(pressureLevel, t),
                  percent: pressurePercentage.toFixed(0)
                })}
              </p>
              <p className="text-ql-12 text-muted-foreground mt-1">{t('storage_cleanup_hint')}</p>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const isCold = recommendation.action.includes('cold') || recommendation.action.includes('clean')
  const tone = isCold ? TONE_INFO : TONE_WARN
  const Glyph = isCold ? Lightbulb : AlertTriangle
  return (
    <div className={cn(BANNER_SURFACE, tone)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-background/40 flex size-8 shrink-0 items-center justify-center rounded-lg"
        >
          <Glyph className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ql-12 font-semibold">
            {t('storage_reclaim_info', {
              count: recommendation.targetPartitions.length,
              size: formatBytes(recommendation.estimatedFreeBytes)
            })}
          </p>
          <p className="text-ql-12 text-muted-foreground mt-1 truncate">
            {t('storage_reclaim_target', {
              targets: recommendation.targetPartitions.slice(0, 3).join(', ')
            })}
            {recommendation.targetPartitions.length > 3
              ? ` +${recommendation.targetPartitions.length - 3}`
              : ''}
            {' · '}
            <span className="font-mono">{recommendation.reason}</span>
          </p>
        </div>
        {onAction && (
          <button
            type="button"
            onClick={() => onAction(recommendation.action)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-1.5 transition-colors',
              isCold
                ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
                : 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700'
            )}
          >
            {/* `font: inherit` on <button> beats Tailwind text utilities, so the
                label size lives on an inner span instead of the control. */}
            <span className="text-ql-12 font-medium">{t('storage_clean_action')}</span>
          </button>
        )}
      </div>
    </div>
  )
})
