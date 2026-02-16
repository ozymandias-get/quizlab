import { memo } from 'react'
import { useLanguage } from '@src/app/providers'

interface AiErrorViewProps {
    error: string;
    onRetry: () => void;
    aiName?: string;
}

const AiErrorView = memo(({ error, onRetry, aiName }: AiErrorViewProps) => {
    const { t } = useLanguage()

    return (
        <div className="absolute inset-0 bg-stone-900/95 backdrop-blur-sm flex items-center justify-center z-10 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center gap-5 p-10 max-w-xs">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg className="text-red-400/80" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                    </svg>
                </div>
                <h3 className="font-display text-xl font-semibold text-stone-200">
                    {t('ai_error_title', { name: aiName || 'AI' })}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">{error}</p>
                <button
                    className="btn-secondary flex items-center gap-2 mt-2 px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors"
                    onClick={onRetry}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 4v6h-6" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    <span>{t('try_again')}</span>
                </button>
            </div>
        </div>
    )
})

AiErrorView.displayName = 'AiErrorView'
export default AiErrorView
