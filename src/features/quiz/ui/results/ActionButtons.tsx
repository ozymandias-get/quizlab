
import React from 'react'
import { RotateCcw, RefreshCw, TrendingUp } from 'lucide-react'

interface ActionButtonsProps {
    onRestart: () => void;
    onRegenerate: () => void;
    onRetryMistakes: () => void;
    hasIncorrectOrEmpty: boolean;
    t: (key: string) => string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    onRestart,
    onRegenerate,
    onRetryMistakes,
    hasIncorrectOrEmpty,
    t
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
                onClick={onRestart}
                className="py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
                <RotateCcw className="w-5 h-5" />
                {t('quiz_restart')}
            </button>

            <button
                onClick={onRegenerate}
                className="py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
                <RefreshCw className="w-5 h-5" />
                {t('quiz_regenerate')}
            </button>

            {hasIncorrectOrEmpty && (
                <button
                    onClick={onRetryMistakes}
                    className="py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
                >
                    <TrendingUp className="w-5 h-5" />
                    {t('quiz_retry_mistakes')}
                </button>
            )}
        </div>
    )
}
