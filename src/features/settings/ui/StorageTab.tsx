import {
  useCacheInfo,
  useClearCache,
  useClearPartitionCache,
  useDeepCleanCache,
  useSetCacheAutoClean,
  useSmartCacheAction
} from '@platform/electron/api/useSettingsSystemApi'

import { Button } from '@app/components/ui/button'
import { Switch } from '@app/components/ui/switch'
import { formatBytes } from '@shared/lib/formatUtils'
import { cn } from '@shared/lib/uiUtils'
import {
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro
} from '@shared/ui/components/primitives'
import { RefreshIcon } from '@ui/components/Icons'

import {
  Check,
  FolderTree,
  HardDrive,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PartitionRow,
  ProgressBar,
  RootCacheRow,
  SmartRecommendationBanner
} from './storage/StorageComponents'
import {
  formatTimeAgo,
  partitionDisplayName,
  pressureColor,
  pressureLabel
} from './storage/storageUtils'

const MAX_TOTAL_CACHE_BYTES = 500 * 1024 * 1024

/** Nested list surface: recessed inside a section card, so it never uses `bg-card`. */
const INSET_LIST = 'border-border/60 bg-background/40 rounded-xl border'

/** Pill surface for the pressure badge. Kept semantic: it encodes cache health. */
function pressureBadgeTone(level: string): string {
  switch (level) {
    case 'critical':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
    case 'high':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400'
    case 'warning':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'moderate':
      return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
    default:
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  }
}

/** Numeric readout beside the meter. Healthy = emerald, pressure = amber, over = destructive. */
function pressureReadoutTone(level: string, isOverLimit: boolean): string {
  if (isOverLimit) return 'text-destructive'
  if (level === 'warning' || level === 'high' || level === 'critical') {
    return 'text-amber-600 dark:text-amber-400'
  }
  return 'text-emerald-600 dark:text-emerald-400'
}

const StorageTab = memo(function StorageTab() {
  const { t, i18n } = useTranslation()
  const { data: cacheInfo, refetch: refetchCache } = useCacheInfo()
  const { mutate: clearCache, isPending: isClearing, isSuccess: isClearSuccess } = useClearCache()
  const { mutate: deepCleanCache, isPending: isDeepCleaning } = useDeepCleanCache()
  const { mutate: smartAction, isPending: isSmartCleaning } = useSmartCacheAction()
  const { mutate: clearPartition } = useClearPartitionCache()
  const { mutate: setAutoClean } = useSetCacheAutoClean()

  const handleClear = useCallback(() => {
    clearCache()
  }, [clearCache])

  const handleDeepClean = useCallback(() => {
    deepCleanCache()
  }, [deepCleanCache])

  const handleSmartClean = useCallback(
    (action: string) => {
      // recommendation action mapping: clean_cold vs clean_all
      if (action === 'clean_all_partitions' || action === 'deep_clean') {
        smartAction('clean_all')
      } else {
        smartAction('clean_cold')
      }
    },
    [smartAction]
  )

  const handleRefresh = useCallback(() => {
    void refetchCache()
  }, [refetchCache])

  const breakdown = cacheInfo?.breakdown
  const smart = cacheInfo?.smart

  // Fallback: derive partition details from plain partitionCaches if smart missing
  const partitionDetails = useMemo(() => {
    if (smart?.partitionDetails && smart.partitionDetails.length > 0) {
      return smart.partitionDetails
        .filter((d) => d.size > 0 || d.category === 'cold')
        .sort((a, b) => b.size - a.size)
        .map((d) => ({
          key: d.key,
          label: partitionDisplayName(d.key, t),
          size: d.size,
          category: d.category,
          lastActive: d.lastActive
        }))
    }
    const caches = breakdown?.partitionCaches ?? {}
    return Object.entries(caches)
      .sort(([, a], [, b]) => b - a)
      .map(([key, size]) => ({
        key,
        label: partitionDisplayName(key, t),
        size,
        category: undefined as unknown as 'active' | 'passive' | 'cold',
        lastActive: null as number | null
      }))
  }, [smart?.partitionDetails, breakdown?.partitionCaches, t])

  const totalCache = breakdown?.total ?? 0
  const pressureLevel =
    smart?.pressureLevel ??
    (totalCache > MAX_TOTAL_CACHE_BYTES
      ? 'critical'
      : totalCache / MAX_TOTAL_CACHE_BYTES > 0.8
        ? 'warning'
        : 'normal')
  const pressurePct = smart?.pressurePercentage ?? (totalCache / MAX_TOTAL_CACHE_BYTES) * 100
  const isOverLimit = totalCache > MAX_TOTAL_CACHE_BYTES
  const barColor = pressureColor(pressureLevel)

  const autoCleanEnabled = smart?.autoClean.enabled ?? true

  const handleToggleAutoClean = useCallback(
    (checked: boolean) => {
      setAutoClean(checked)
    },
    [setAutoClean]
  )

  const handleClearPartition = useCallback(
    (partitionKey: string) => {
      // partitionKey is like "ai_chatgpt" – need to map to persist:ai_xxx
      const partition = partitionKey.startsWith('persist:')
        ? partitionKey
        : `persist:${partitionKey}`
      clearPartition({ partition })
    },
    [clearPartition]
  )

  return (
    <div className="space-y-6 pb-4">
      <SettingsTabIntro
        icon={
          <SettingsTabIcon>
            <RefreshIcon className="h-5 w-5" />
          </SettingsTabIcon>
        }
        description={`${t('storage_description')} ${t('smart_cache_desc')}`}
      />

      {/* Overall Usage + Smart Health */}
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
            {pressureLabel(pressureLevel, t)} · {pressurePct.toFixed(0)}%
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
        {isOverLimit && <p className="text-ql-11 text-destructive">{t('storage_exceeds_limit')}</p>}
        {pressureLevel === 'warning' && !isOverLimit && (
          <p className="text-ql-11 text-amber-600 dark:text-amber-400">
            {t('storage_approaching_limit')}
          </p>
        )}

        {/* Auto-clean toggle */}
        <div className="border-border/60 bg-background/40 flex items-center justify-between gap-3 rounded-xl border p-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden
              className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-ql-12 text-foreground font-medium">{t('cache_auto_clean')}</p>
              <p className="text-ql-11 text-muted-foreground mt-0.5">
                {t('cache_auto_clean_desc')}
              </p>
            </div>
          </div>
          <Switch
            checked={autoCleanEnabled}
            onCheckedChange={handleToggleAutoClean}
            aria-label={t('cache_auto_clean')}
            className="shrink-0"
          />
        </div>
      </SettingsSection>

      {/* Smart Recommendation */}
      {smart?.recommendation && (
        <SmartRecommendationBanner
          pressureLevel={pressureLevel}
          pressurePercentage={pressurePct}
          recommendation={smart.recommendation}
          onAction={handleSmartClean}
          t={t}
        />
      )}

      {/* Actions + Last Cleanup Info */}
      <SettingsSection
        icon={<Trash2 className="h-4 w-4" />}
        title={t('clear_cache_title')}
        detail={t('clear_cache_desc')}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            onClick={handleClear}
            disabled={isClearing}
            variant={isClearSuccess ? 'secondary' : 'destructive'}
            size="sm"
            className="gap-1.5"
          >
            {isClearing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {/* `font: inherit` on <button> beats Tailwind text utilities, so the
                    label size lives on an inner span instead of the control. */}
                <span className="text-ql-12">{t('clearing')}</span>
              </>
            ) : isClearSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span className="text-ql-12">{t('cleared')}</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-ql-12">{t('clear_cache')}</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleDeepClean}
            disabled={isDeepCleaning}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            {isDeepCleaning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span className="text-ql-12">{t('deep_clean')}</span>
          </Button>

          {smart?.recommendation && smart.recommendation.action !== 'none' && (
            <Button
              type="button"
              onClick={() => handleSmartClean(smart.recommendation.action)}
              disabled={isSmartCleaning}
              variant="secondary"
              size="sm"
              className="gap-1.5"
            >
              {isSmartCleaning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="text-ql-12">
                {smart.recommendation.action === 'clean_all_partitions' ||
                smart.recommendation.action === 'deep_clean'
                  ? t('deep_clean')
                  : t('smart_clean_cold')}
              </span>
            </Button>
          )}

          <Button
            type="button"
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-ql-12">{t('refresh')}</span>
          </Button>
        </div>

        {(cacheInfo?.lastCleanup || smart?.autoClean.lastAutoCleanAt) && (
          <div className="space-y-1">
            {cacheInfo?.lastCleanup && (
              <p className="text-ql-11 text-muted-foreground">
                {t('cache_last_cleanup', {
                  time: formatTimeAgo(cacheInfo.lastCleanup, i18n.language)
                })}
                {cacheInfo.lastCleanupResult &&
                  typeof cacheInfo.lastCleanupResult.filesDeleted === 'number' &&
                  typeof cacheInfo.lastCleanupResult.bytesFreed === 'number' &&
                  ` ${t('storage_cleanup_result', {
                    files: cacheInfo.lastCleanupResult.filesDeleted,
                    bytes: formatBytes(cacheInfo.lastCleanupResult.bytesFreed)
                  })}`}
              </p>
            )}
            {smart?.autoClean.lastAutoCleanAt ? (
              <p className="text-ql-11 text-muted-foreground">
                {t('cache_last_auto_clean', {
                  time: formatTimeAgo(smart.autoClean.lastAutoCleanAt, i18n.language)
                })}
              </p>
            ) : (
              <p className="text-ql-11 text-muted-foreground">{t('cache_never_auto_cleaned')}</p>
            )}
          </div>
        )}
      </SettingsSection>

      {/* Root Caches */}
      {breakdown && (
        <SettingsSection icon={<FolderTree className="h-4 w-4" />} title={t('root_caches')}>
          <div className={cn(INSET_LIST, 'space-y-3 p-4')}>
            <RootCacheRow label={t('browser_cache')} size={breakdown.chromiumCache} />
            <RootCacheRow label={t('code_cache')} size={breakdown.codeCache} />
            <RootCacheRow label={t('gpu_cache')} size={breakdown.gpuCache} />
            {breakdown.tempFiles > 0 && (
              <RootCacheRow label={t('temp_files')} size={breakdown.tempFiles} />
            )}
          </div>
        </SettingsSection>
      )}

      {/* Partition Caches – smart */}
      {partitionDetails.length > 0 && (
        <SettingsSection
          icon={<Layers className="h-4 w-4" />}
          title={t('ai_partitions_count', { count: partitionDetails.length })}
        >
          <div className={cn(INSET_LIST, 'divide-border/60 divide-y overflow-hidden')}>
            {partitionDetails.map(({ key, label, size, category, lastActive }) => (
              <PartitionRow
                key={key}
                partitionKey={key}
                label={label}
                size={size}
                category={category}
                lastActive={lastActive}
                onClear={() => handleClearPartition(key)}
                t={t}
              />
            ))}
          </div>
          <p className="text-ql-11 text-muted-foreground">
            {t('storage_partition_summary', {
              smart: t('smart_cache_desc'),
              cold: partitionDetails.filter((p) => p.category === 'cold').length,
              idle: partitionDetails.filter((p) => p.category === 'passive').length,
              active: partitionDetails.filter((p) => p.category === 'active').length
            })}
          </p>
        </SettingsSection>
      )}
    </div>
  )
})

export default StorageTab
