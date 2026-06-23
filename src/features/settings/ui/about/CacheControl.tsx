import { CheckIcon, LoaderIcon, TrashIcon } from '@ui/components/Icons'

import { memo } from 'react'

import AboutActionCard from './AboutActionCard'

interface CacheControlProps {
  t: (key: string) => string
  handleClearCache: () => void
  isClearing: boolean
  isClearSuccess: boolean
  handleDeepClean?: () => void
  isDeepCleaning?: boolean
  cacheSize?: string | null
  lastCleanupTime?: number | null
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const CacheControl = memo(
  ({
    t,
    handleClearCache,
    isClearing,
    isClearSuccess,
    handleDeepClean,
    isDeepCleaning,
    cacheSize,
    lastCleanupTime
  }: CacheControlProps) => {
    const lastCleanupText = lastCleanupTime
      ? t('cache_last_cleanup').replace('{{time}}', formatTimeAgo(lastCleanupTime))
      : null

    const description = cacheSize
      ? `${t('clear_cache_desc')} (${cacheSize})${lastCleanupText ? ` \u2022 ${lastCleanupText}` : ''}`
      : t('clear_cache_desc')

    return (
      <div className="space-y-3">
        <AboutActionCard
          title={t('clear_cache_title')}
          description={description}
          trailing={
            <div className="flex items-center gap-2">
              {handleDeepClean && (
                <button
                  type="button"
                  onClick={handleDeepClean}
                  disabled={isDeepCleaning}
                  className={`text-ql-11 flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition-colors ${'border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
                >
                  {isDeepCleaning ? (
                    <LoaderIcon className="h-4 w-4 text-white" />
                  ) : (
                    <TrashIcon className="h-4 w-4" />
                  )}
                  {t('deep_clean')}
                </button>
              )}
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearing}
                className={`text-ql-11 flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold transition-colors ${
                  isClearSuccess
                    ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                    : 'border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                {isClearing ? (
                  <>
                    <LoaderIcon className="h-4 w-4 text-white" />
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
            </div>
          }
        />
      </div>
    )
  }
)

CacheControl.displayName = 'CacheControl'
export default CacheControl
