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
import { RefreshIcon } from '@ui/components/Icons'

import { Check, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'
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
          <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
            <RefreshIcon className="h-5 w-5" />
          </div>
        }
        description={`${t('storage_description')} ${t('smart_cache_desc')}`}
      />

      {/* Overall Usage + Smart Health */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-ql-13 text-foreground font-semibold">{t('total_cache')}</h3>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                pressureLevel === 'critical'
                  ? 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
                  : pressureLevel === 'high'
                    ? 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-400'
                    : pressureLevel === 'warning'
                      ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
                      : pressureLevel === 'moderate'
                        ? 'border-yellow-200 bg-yellow-100 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-400'
                        : 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
              )}
            >
              {pressureLabel(pressureLevel, t)} · {pressurePct.toFixed(0)}%
            </span>
            <span
              className={cn(
                'text-ql-12 font-mono',
                isOverLimit
                  ? 'text-destructive'
                  : pressureLevel === 'warning' ||
                      pressureLevel === 'high' ||
                      pressureLevel === 'critical'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {formatBytes(totalCache)} / {formatBytes(MAX_TOTAL_CACHE_BYTES)}
            </span>
          </div>
        </div>
        <ProgressBar value={totalCache} max={MAX_TOTAL_CACHE_BYTES} color={barColor} />
        {isOverLimit && <p className="text-ql-11 text-destructive">{t('storage_exceeds_limit')}</p>}
        {pressureLevel === 'warning' && !isOverLimit && (
          <p className="text-ql-11 text-amber-600 dark:text-amber-400">
            {t('storage_approaching_limit')}
          </p>
        )}

        {/* Auto-clean toggle */}
        <div className="border-border/60 flex items-center justify-between border-t pt-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary h-3.5 w-3.5" />
              <span className="text-ql-12 text-foreground font-medium">
                {t('cache_auto_clean')}
              </span>
            </div>
            <p className="text-ql-11 text-muted-foreground">{t('cache_auto_clean_desc')}</p>
          </div>
          <Switch
            checked={autoCleanEnabled}
            onCheckedChange={handleToggleAutoClean}
            aria-label={t('cache_auto_clean')}
          />
        </div>
      </div>

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

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={handleClear}
          disabled={isClearing}
          variant={isClearSuccess ? 'default' : 'destructive'}
          size="sm"
          className="gap-1.5"
        >
          {isClearing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t('clearing')}</span>
            </>
          ) : isClearSuccess ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>{t('cleared')}</span>
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('clear_cache')}</span>
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
          <span>{t('deep_clean')}</span>
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
            <span>
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
          <span>{t('refresh')}</span>
        </Button>
      </div>

      {/* Last Cleanup Info */}
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

      {/* Root Caches */}
      {breakdown && (
        <div className="space-y-3">
          <h3 className="text-ql-13 text-foreground font-semibold">{t('root_caches')}</h3>
          <div className="border-border bg-card space-y-3 overflow-hidden rounded-xl border p-5 shadow-xs">
            <RootCacheRow label={t('browser_cache')} size={breakdown.chromiumCache} />
            <RootCacheRow label={t('code_cache')} size={breakdown.codeCache} />
            <RootCacheRow label={t('gpu_cache')} size={breakdown.gpuCache} />
            {breakdown.tempFiles > 0 && (
              <RootCacheRow label={t('temp_files')} size={breakdown.tempFiles} />
            )}
          </div>
        </div>
      )}

      {/* Partition Caches – smart */}
      {partitionDetails.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-ql-13 text-foreground font-semibold">
            {t('ai_partitions_count', { count: partitionDetails.length })}
          </h3>
          <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
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
          <p className="text-ql-11 text-muted-foreground px-1">
            {t('storage_partition_summary', {
              smart: t('smart_cache_desc'),
              cold: partitionDetails.filter((p) => p.category === 'cold').length,
              idle: partitionDetails.filter((p) => p.category === 'passive').length,
              active: partitionDetails.filter((p) => p.category === 'active').length
            })}
          </p>
        </div>
      )}
    </div>
  )
})

export default StorageTab
