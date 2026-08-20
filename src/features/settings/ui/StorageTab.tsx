import {
  useCacheInfo,
  useClearCache,
  useDeepCleanCache
} from '@platform/electron/api/useSettingsSystemApi'

import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'
import { RefreshIcon } from '@ui/components/Icons'

import { Check, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'
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
      <SettingsTabIntro
        icon={
          <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
            <RefreshIcon className="h-5 w-5" />
          </div>
        }
        description={t('storage_description')}
      />

      {/* Overall Usage */}
      <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-ql-13 text-foreground font-semibold">Total Cache</h3>
          <span
            className={cn(
              'text-ql-12 font-mono',
              isOverLimit
                ? 'text-destructive'
                : usagePct > 80
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {formatBytes(totalCache)} / {formatBytes(MAX_TOTAL_CACHE_BYTES)}
          </span>
        </div>
        <ProgressBar value={totalCache} max={MAX_TOTAL_CACHE_BYTES} color={barColor} />
        {isOverLimit && (
          <p className="text-ql-11 text-destructive">
            Cache exceeds 500 MB limit. Some partitions will be automatically trimmed.
          </p>
        )}
        {usagePct > 80 && !isOverLimit && (
          <p className="text-ql-11 text-amber-600 dark:text-amber-400">
            Cache is approaching the limit. Consider cleaning unused partitions.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
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

        <Button
          type="button"
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Last Cleanup Info */}
      {cacheInfo?.lastCleanup && (
        <p className="text-ql-11 text-muted-foreground">
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
          <h3 className="text-ql-13 text-foreground font-semibold">Root Caches</h3>
          <div className="border-border bg-card space-y-3 overflow-hidden rounded-xl border p-5 shadow-xs">
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
          <h3 className="text-ql-13 text-foreground font-semibold">
            AI Partitions ({sortedPartitions.length})
          </h3>
          <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
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
