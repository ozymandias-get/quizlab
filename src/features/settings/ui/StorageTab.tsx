import {
  useCacheInfo,
  useClearCache,
  useDeepCleanCache
} from '@platform/electron/api/useSettingsSystemApi'

import { CheckIcon, LoaderIcon, RefreshIcon, TrashIcon } from '@ui/components/Icons'

import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PartitionRow, ProgressBar, RootCacheRow } from './storage/StorageComponents'
import { formatBytes, formatTimeAgo, partitionDisplayName } from './storage/storageUtils'

const MAX_TOTAL_CACHE_BYTES = 500 * 1024 * 1024

const StorageTab = memo(function StorageTab() {
  const { t } = useTranslation()
  const { data: cacheInfo, refetch: refetchCache } = useCacheInfo()
  const { mutate: clearCache, isPending: isClearing, isSuccess: isClearSuccess } = useClearCache()
  const { mutate: deepCleanCache, isPending: isDeepCleaning } = useDeepCleanCache()

  const handleClear = useCallback(() => {
    clearCache()
  }, [clearCache])

  const handleDeepClean = useCallback(() => {
    deepCleanCache()
  }, [deepCleanCache])

  const handleRefresh = useCallback(() => {
    void refetchCache()
  }, [refetchCache])

  const breakdown = cacheInfo?.breakdown
  const partitionCaches = useMemo(
    () => breakdown?.partitionCaches ?? {},
    [breakdown?.partitionCaches]
  )

  const sortedPartitions = useMemo(() => {
    return Object.entries(partitionCaches)
      .sort(([, a], [, b]) => b - a)
      .map(([key, size]) => ({
        key,
        label: partitionDisplayName(key),
        size
      }))
  }, [partitionCaches])

  const totalCache = breakdown?.total ?? 0
  const usagePct = (totalCache / MAX_TOTAL_CACHE_BYTES) * 100
  const isOverLimit = totalCache > MAX_TOTAL_CACHE_BYTES
  const barColor = isOverLimit
    ? 'bg-rose-500'
    : usagePct > 80
      ? 'bg-amber-500'
      : usagePct > 50
        ? 'bg-emerald-500'
        : 'bg-emerald-400'

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h2 className="text-ql-13 font-semibold text-white/90">Storage</h2>
        <p className="text-ql-12 text-foreground/75 mt-1">
          Cache and storage usage for AI model partitions
        </p>
      </div>

      {/* Overall Usage */}
      <div className="space-y-3 rounded-[24px] border border-white/[0.12] bg-white/[0.04] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-ql-13 font-semibold text-white/80">Total Cache</h3>
          <span
            className={cn(
              'text-ql-12 font-mono',
              isOverLimit ? 'text-rose-400' : usagePct > 80 ? 'text-amber-400' : 'text-emerald-400'
            )}
          >
            {formatBytes(totalCache)} / {formatBytes(MAX_TOTAL_CACHE_BYTES)}
          </span>
        </div>
        <ProgressBar value={totalCache} max={MAX_TOTAL_CACHE_BYTES} color={barColor} />
        {isOverLimit && (
          <p className="text-ql-11 text-rose-400/80">
            Cache exceeds 500 MB limit. Some partitions will be automatically trimmed.
          </p>
        )}
        {usagePct > 80 && !isOverLimit && (
          <p className="text-ql-11 text-amber-400/80">
            Cache is approaching the limit. Consider cleaning unused partitions.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={isClearing}
          className={cn(
            'text-ql-11 flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition-colors',
            isClearSuccess
              ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
              : 'border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
          )}
        >
          {isClearing ? (
            <>
              <LoaderIcon className="h-4 w-4" />
              {t('clearing')}
            </>
          ) : isClearSuccess ? (
            <>
              <CheckIcon className="h-4 w-4" />
              {t('cleared')}
            </>
          ) : (
            <>
              <TrashIcon className="h-4 w-4" />
              {t('clear_cache')}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDeepClean}
          disabled={isDeepCleaning}
          className="text-ql-11 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
        >
          {isDeepCleaning ? <LoaderIcon className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
          {t('deep_clean')}
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          className="text-ql-11 text-foreground/80 ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-semibold transition-colors hover:bg-white/[0.08]"
        >
          <RefreshIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Last Cleanup Info */}
      {cacheInfo?.lastCleanup && (
        <p className="text-ql-11 text-foreground/75">
          Last cleanup: {formatTimeAgo(cacheInfo.lastCleanup)}
          {cacheInfo.lastCleanupResult &&
            typeof cacheInfo.lastCleanupResult.filesDeleted === 'number' &&
            typeof cacheInfo.lastCleanupResult.bytesFreed === 'number' &&
            ` (${cacheInfo.lastCleanupResult.filesDeleted} files, ${formatBytes(cacheInfo.lastCleanupResult.bytesFreed)} freed)`}
        </p>
      )}

      {/* Root Caches */}
      {breakdown && (
        <div className="space-y-3">
          <h3 className="text-ql-13 font-semibold text-white/80">Root Caches</h3>
          <div className="space-y-3 overflow-hidden rounded-[24px] border border-white/[0.12] bg-white/[0.04] p-5">
            <RootCacheRow label="Browser Cache" size={breakdown.chromiumCache} />
            <RootCacheRow label="Code Cache" size={breakdown.codeCache} />
            <RootCacheRow label="GPU Cache" size={breakdown.gpuCache} />
            {breakdown.tempFiles > 0 && (
              <RootCacheRow label="Temp Files" size={breakdown.tempFiles} />
            )}
          </div>
        </div>
      )}

      {/* Partition Caches */}
      {sortedPartitions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-ql-13 font-semibold text-white/80">
            AI Partitions ({sortedPartitions.length})
          </h3>
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.12] bg-white/[0.04]">
            {sortedPartitions.map(({ key, label, size }) => (
              <PartitionRow key={key} partitionKey={key} label={label} size={size} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

export default StorageTab
