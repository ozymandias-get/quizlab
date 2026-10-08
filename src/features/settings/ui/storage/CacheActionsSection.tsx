/**
 * The destructive-actions section: clear, deep clean, the recommendation-driven
 * smart clean and a manual refresh — plus the read-out of when the cache was
 * last cleaned.
 */
import { formatBytes } from '@shared/lib/formatUtils'
import { Button, SettingsSection } from '@shared/ui/components/primitives'

import type { TFunction } from 'i18next'
import { Check, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { memo } from 'react'

import { formatTimeAgo } from './storageUtils'

export interface CacheCleanupReadout {
  /** Timestamp of the last manual cleanup, if one has run. */
  lastCleanup: number | null
  /** Only rendered when both are known numbers. */
  filesDeleted?: number
  bytesFreed?: number
  /** Timestamp of the last automatic cleanup, if one has run. */
  lastAutoCleanAt: number | null
}

export const CacheActionsSection = memo(function CacheActionsSection({
  isClearing,
  isClearSuccess,
  isDeepCleaning,
  isSmartCleaning,
  showSmartClean,
  smartCleanLabel,
  lastCleanup,
  onClear,
  onDeepClean,
  onSmartClean,
  onRefresh,
  language,
  t
}: {
  isClearing: boolean
  isClearSuccess: boolean
  isDeepCleaning: boolean
  isSmartCleaning: boolean
  /** False when the scheduler has no recommendation worth a button. */
  showSmartClean: boolean
  smartCleanLabel: string
  lastCleanup: CacheCleanupReadout | null
  onClear: () => void
  onDeepClean: () => void
  onSmartClean: () => void
  onRefresh: () => void
  language: string
  t: TFunction
}) {
  return (
    <SettingsSection
      icon={<Trash2 className="h-4 w-4" />}
      title={t('clear_cache_title')}
      detail={t('clear_cache_desc')}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={onClear}
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
          onClick={onDeepClean}
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

        {showSmartClean && (
          <Button
            type="button"
            onClick={onSmartClean}
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
            <span className="text-ql-12">{smartCleanLabel}</span>
          </Button>
        )}

        <Button
          type="button"
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="text-ql-12">{t('refresh')}</span>
        </Button>
      </div>

      {lastCleanup && (
        <div className="space-y-1">
          {lastCleanup.lastCleanup && (
            <p className="text-ql-11 text-muted-foreground">
              {t('cache_last_cleanup', {
                time: formatTimeAgo(lastCleanup.lastCleanup, language)
              })}
              {lastCleanup.filesDeleted !== undefined &&
                lastCleanup.bytesFreed !== undefined &&
                ` ${t('storage_cleanup_result', {
                  files: lastCleanup.filesDeleted,
                  bytes: formatBytes(lastCleanup.bytesFreed)
                })}`}
            </p>
          )}
          {lastCleanup.lastAutoCleanAt ? (
            <p className="text-ql-11 text-muted-foreground">
              {t('cache_last_auto_clean', {
                time: formatTimeAgo(lastCleanup.lastAutoCleanAt, language)
              })}
            </p>
          ) : (
            <p className="text-ql-11 text-muted-foreground">{t('cache_never_auto_cleaned')}</p>
          )}
        </div>
      )}
    </SettingsSection>
  )
})
