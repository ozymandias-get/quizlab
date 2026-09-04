import { Button } from '@app/components/ui/button'

import type { TFunction } from 'i18next'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { memo } from 'react'

import { formatTimeAgo } from '../storage/storageUtils'
import AboutActionCard from './AboutActionCard'

interface CacheControlProps {
  t: TFunction
  language: string
  handleClearCache: () => void
  isClearing: boolean
  isClearSuccess: boolean
  handleDeepClean?: () => void
  isDeepCleaning?: boolean
  cacheSize?: string | null
  lastCleanupTime?: number | null
}

const CacheControl = memo(
  ({
    t,
    language,
    handleClearCache,
    isClearing,
    isClearSuccess,
    handleDeepClean,
    isDeepCleaning,
    cacheSize,
    lastCleanupTime
  }: CacheControlProps) => {
    const lastCleanupText = lastCleanupTime
      ? t('cache_last_cleanup', { time: formatTimeAgo(lastCleanupTime, language) })
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
