/**
 * Storage settings tab: the cache pressure meter, the cleanup actions and the
 * per-partition breakdown.
 *
 * The tab owns only the data wiring — six mutations, the derived view-model and
 * the callbacks. Every rendered section, and every rule that turns a cache-info
 * response into something displayable, lives in `./storage/`; this file is the
 * controller that connects them.
 */
import {
  useCacheInfo,
  useClearCache,
  useClearPartitionCache,
  useDeepCleanCache,
  useSetCacheAutoClean,
  useSmartCacheAction
} from '@platform/electron/api/useSettingsSystemApi'

import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { RefreshIcon } from '@ui/components/Icons'

import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CacheActionsSection } from './storage/CacheActionsSection'
import { PartitionCacheSection, RootCacheSection } from './storage/CacheBreakdownSections'
import { resolveCachePressure, resolvePartitionCacheRows } from './storage/cacheUsageSummary'
import { SmartRecommendationBanner } from './storage/StorageComponents'
import { TotalCacheSection } from './storage/TotalCacheSection'
import { useDeepCleanConfirm } from './storage/useDeepCleanConfirm'

/** Recommendation actions that both mean "wipe everything". */
const DEEP_CLEAN_ACTIONS = new Set(['clean_all_partitions', 'deep_clean'])

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

  const { requestDeepClean, confirmProps: deepCleanConfirmProps } = useDeepCleanConfirm({
    cacheInfo,
    t,
    onConfirm: deepCleanCache
  })

  const handleSmartClean = useCallback(
    (action: string) => {
      // The recommendation-driven path can also be "wipe everything". It must
      // go through the same session warning instead of bypassing it.
      if (DEEP_CLEAN_ACTIONS.has(action)) {
        void requestDeepClean()
        return
      }
      smartAction('clean_cold')
    },
    [requestDeepClean, smartAction]
  )

  const handleRefresh = useCallback(() => {
    void refetchCache()
  }, [refetchCache])

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

  const pressure = useMemo(() => resolveCachePressure(cacheInfo), [cacheInfo])
  const partitionRows = useMemo(() => resolvePartitionCacheRows(cacheInfo, t), [cacheInfo, t])

  // Same source colours the section's legend uses: Chromium = sky, code =
  // violet, GPU = emerald, temp = amber. Temp files stay out of the legend when
  // they are empty, exactly like the optional root-cache row.
  const cacheSegments = useMemo(() => {
    const breakdown = cacheInfo?.breakdown
    if (!breakdown) return undefined
    const partitionBytes = Object.values(breakdown.partitionCaches ?? {}).reduce(
      (sum, size) => sum + size,
      0
    )
    const segments = [
      {
        key: 'chromium',
        label: t('browser_cache'),
        size: breakdown.chromiumCache,
        color: 'bg-sky-500'
      },
      { key: 'code', label: t('code_cache'), size: breakdown.codeCache, color: 'bg-violet-500' },
      { key: 'gpu', label: t('gpu_cache'), size: breakdown.gpuCache, color: 'bg-emerald-500' },
      { key: 'temp', label: t('temp_files'), size: breakdown.tempFiles, color: 'bg-amber-500' },
      // Partition data is part of `breakdown.total`; without it the stacked
      // bar silently renormalised to the root caches only.
      {
        key: 'partitions',
        label: t('storage_partition_caches'),
        size: partitionBytes,
        color: 'bg-teal-500'
      }
    ]
    return segments.filter((segment) => segment.size > 0)
  }, [cacheInfo?.breakdown, t])

  const smart = cacheInfo?.smart
  const recommendationAction = smart?.recommendation?.action
  const showSmartClean = Boolean(smart?.recommendation) && recommendationAction !== 'none'

  const cleanupReadout = useMemo(() => {
    const lastCleanup = cacheInfo?.lastCleanup ?? null
    const lastAutoCleanAt = smart?.autoClean.lastAutoCleanAt ?? null
    if (!lastCleanup && !lastAutoCleanAt) return null

    const result = cacheInfo?.lastCleanupResult
    return {
      lastCleanup,
      lastAutoCleanAt,
      // Only present, numeric fields are rendered; a hand-edited store may hold
      // anything, and the read-out degrades to the bare timestamp.
      filesDeleted: typeof result?.filesDeleted === 'number' ? result.filesDeleted : undefined,
      bytesFreed: typeof result?.bytesFreed === 'number' ? result.bytesFreed : undefined
    }
  }, [cacheInfo?.lastCleanup, cacheInfo?.lastCleanupResult, smart?.autoClean.lastAutoCleanAt])

  const handleSmartCleanRecommended = useCallback(() => {
    // Dispatches unconditionally, like the original inline handler did: the
    // button is only rendered when a recommendation exists, and any action the
    // scheduler did not recognise falls through to `clean_cold`.
    handleSmartClean(recommendationAction ?? '')
  }, [handleSmartClean, recommendationAction])

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

      <TotalCacheSection
        totalCache={cacheInfo?.breakdown?.total ?? 0}
        pressureLevel={pressure.level}
        pressurePercentage={pressure.percentage}
        isOverLimit={pressure.isOverLimit}
        barColor={pressure.barColor}
        segments={cacheSegments}
        autoCleanEnabled={smart?.autoClean.enabled ?? true}
        onToggleAutoClean={handleToggleAutoClean}
        t={t}
      />

      {smart?.recommendation && (
        <SmartRecommendationBanner
          pressureLevel={pressure.level}
          pressurePercentage={pressure.percentage}
          recommendation={smart.recommendation}
          onAction={handleSmartClean}
          t={t}
        />
      )}

      <CacheActionsSection
        isClearing={isClearing}
        isClearSuccess={isClearSuccess}
        isDeepCleaning={isDeepCleaning}
        isSmartCleaning={isSmartCleaning}
        showSmartClean={showSmartClean}
        smartCleanLabel={
          recommendationAction && DEEP_CLEAN_ACTIONS.has(recommendationAction)
            ? t('deep_clean')
            : t('smart_clean_cold')
        }
        lastCleanup={cleanupReadout}
        onClear={handleClear}
        onDeepClean={requestDeepClean}
        onSmartClean={handleSmartCleanRecommended}
        onRefresh={handleRefresh}
        language={i18n.language}
        t={t}
      />

      {cacheInfo?.breakdown && (
        <RootCacheSection
          chromiumCache={cacheInfo.breakdown.chromiumCache}
          codeCache={cacheInfo.breakdown.codeCache}
          gpuCache={cacheInfo.breakdown.gpuCache}
          tempFiles={cacheInfo.breakdown.tempFiles}
          t={t}
        />
      )}

      {partitionRows.length > 0 && (
        <PartitionCacheSection rows={partitionRows} onClearPartition={handleClearPartition} t={t} />
      )}

      <ConfirmDialog {...deepCleanConfirmProps} />
    </div>
  )
})

export default StorageTab
