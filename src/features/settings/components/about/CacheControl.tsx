import { memo } from 'react'
import { LoaderIcon, CheckIcon, TrashIcon } from '@src/components/ui/Icons'

interface CacheControlProps {
    t: (key: string) => string;
    handleClearCache: () => void;
    isClearing: boolean;
    isClearSuccess: boolean;
}

const CacheControl = memo(({ t, handleClearCache, isClearing, isClearSuccess }: CacheControlProps) => {
    return (
        <div className="flex items-center justify-between p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.12]">
            <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">{t('clear_cache_title')}</h4>
                <p className="text-xs text-white/40">{t('clear_cache_desc')}</p>
            </div>
            <button
                onClick={handleClearCache}
                disabled={isClearing}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${isClearSuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
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
        </div>
    )
})

CacheControl.displayName = 'CacheControl'
export default CacheControl
