import { formatBytes } from '@shared/lib/formatUtils'
import { cn } from '@shared/lib/uiUtils'

import { memo } from 'react'

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
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
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
    <div className="flex items-center justify-between">
      <span className="text-ql-12 text-foreground">{label}</span>
      <span className="text-ql-12 text-muted-foreground font-mono">{formatBytes(size)}</span>
    </div>
  )
})

export const PartitionRow = memo(function PartitionRow({
  partitionKey,
  label,
  size,
  category,
  lastActive,
  onClear
}: {
  partitionKey: string
  label: string
  size: number
  category?: 'active' | 'passive' | 'cold'
  lastActive?: number | null
  onClear?: () => void
}) {
  const dotColor =
    category === 'active'
      ? 'bg-emerald-500'
      : category === 'passive'
        ? 'bg-amber-500'
        : 'bg-slate-400'
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            category ? dotColor : 'bg-muted-foreground'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ql-12 text-foreground block truncate font-medium">{label}</span>
            {category && (
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  category === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : category === 'passive'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {category}
              </span>
            )}
          </div>
          <span className="text-ql-11 text-muted-foreground block truncate font-mono">
            {partitionKey}
          </span>
          {lastActive && (
            <span className="text-ql-11 text-muted-foreground block truncate">
              last: {new Date(lastActive).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-ql-12 text-muted-foreground font-mono">{formatBytes(size)}</span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
            title="Clear this partition cache"
            aria-label={`Clear ${label} cache`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
  onAction
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
}) {
  if (!recommendation || recommendation.action === 'none') {
    if (pressureLevel === 'warning' || pressureLevel === 'high' || pressureLevel === 'critical') {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <span className="text-lg text-amber-600 dark:text-amber-400">⚠</span>
          <div className="min-w-0 flex-1">
            <p className="text-ql-12 font-medium text-amber-800 dark:text-amber-300">
              Cache pressure {pressureLevel} ({pressurePercentage.toFixed(0)}%)
            </p>
            <p className="text-ql-11 mt-1 text-amber-700 dark:text-amber-400">
              Automatic cleanup will run soon. You can also clean manually.
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  const isCold = recommendation.action.includes('cold') || recommendation.action.includes('clean')
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        isCold
          ? 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
      )}
    >
      <span className={cn('text-lg', isCold ? 'text-sky-600' : 'text-amber-600')}>💡</span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-ql-12 font-medium',
            isCold ? 'text-sky-800 dark:text-sky-300' : 'text-amber-800 dark:text-amber-300'
          )}
        >
          {recommendation.targetPartitions.length} partitions • ~
          {formatBytes(recommendation.estimatedFreeBytes)} reclaimable
        </p>
        <p className="text-ql-11 text-muted-foreground mt-1 truncate">
          Target: {recommendation.targetPartitions.slice(0, 3).join(', ')}
          {recommendation.targetPartitions.length > 3
            ? ` +${recommendation.targetPartitions.length - 3}`
            : ''}
          {' · '}
          <span className="text-ql-11 font-mono">{recommendation.reason}</span>
        </p>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={() => onAction(recommendation.action)}
          className={cn(
            'text-ql-11 shrink-0 rounded-lg border px-3 py-1.5 font-medium transition-colors',
            isCold
              ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
              : 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700'
          )}
        >
          Clean
        </button>
      )}
    </div>
  )
})
