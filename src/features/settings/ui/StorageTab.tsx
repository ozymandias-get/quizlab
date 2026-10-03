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

import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { RefreshIcon } from '@ui/components/Icons'

import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CacheActionsSection } from './storage/CacheActionsSection'
import { PartitionCacheSection, RootCacheSection } from './storage/CacheBreakdownSections'
import { resolveCachePressure, resolvePartitionCacheRows } from './storage/cacheUsageSummary'
import { SmartRecommendationBanner } from './storage/StorageComponents'
import { TotalCacheSection } from './storage/TotalCacheSection'

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

  const handleDeepClean = useCallback(() => {
    deepCleanCache()
  }, [deepCleanCache])

  const handleSmartClean = useCallback(
    (action: string) => {
      // recommendation action mapping: clean_cold vs clean_all
      smartAction(DEEP_CLEAN_ACTIONS.has(action) ? 'clean_all' : 'clean_cold')
    },
    [smartAction]
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
        onDeepClean={handleDeepClean}
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
    </div>
  )
})

export default StorageTab
