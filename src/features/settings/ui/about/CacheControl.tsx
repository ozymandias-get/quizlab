import { Button } from '@app/components/ui/button'

import { Check, Loader2, Trash2 } from 'lucide-react'
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
              )}
              <Button
                type="button"
                onClick={handleClearCache}
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
            </div>
          }
        />
      </div>
    )
  }
)

CacheControl.displayName = 'CacheControl'
export default CacheControl
