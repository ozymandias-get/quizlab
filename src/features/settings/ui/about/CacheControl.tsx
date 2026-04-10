import { memo } from 'react'
import { LoaderIcon, CheckIcon, TrashIcon } from '@ui/components/Icons'
import AboutActionCard from './AboutActionCard'

interface CacheControlProps {
  t: (key: string) => string
  handleClearCache: () => void
  isClearing: boolean
  isClearSuccess: boolean
}

const CacheControl = memo(
  ({ t, handleClearCache, isClearing, isClearSuccess }: CacheControlProps) => {
    return (
      <AboutActionCard
        title={t('clear_cache_title')}
        description={t('clear_cache_desc')}
        trailing={
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-ql-12 font-bold transition-all ${
              isClearSuccess
                ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                : 'border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            {isClearing ? (
              <>
                <LoaderIcon className="w-4 h-4 text-white" />
                {t('clearing')}
              </>
            ) : isClearSuccess ? (
              <>
                <CheckIcon className="w-4 h-4" />
                {t('cleared')}
              </>
            ) : (
              <>
                <TrashIcon className="w-4 h-4" />
                {t('clear_cache')}
              </>
            )}
          </button>
        }
      />
    )
  }
)

CacheControl.displayName = 'CacheControl'
export default CacheControl
