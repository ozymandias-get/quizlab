import React from 'react'
import { RotateCcw, RefreshCw, TrendingUp } from 'lucide-react'
import { Button } from '@ui/components/button'

interface ActionButtonsProps {
  onRestart: () => void
  onRegenerate: () => void
  onRetryMistakes: () => void
  hasIncorrectOrEmpty: boolean
  t: (key: string) => string
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
      <Button
        type="button"
        variant="outline"
        onClick={onRestart}
        className="h-auto py-4 px-6 rounded-2xl font-bold text-sm bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
      >
        <RotateCcw className="w-5 h-5" />
        {t('quiz_restart')}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onRegenerate}
        className="h-auto py-4 px-6 rounded-2xl font-bold text-sm bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
      >
        <RefreshCw className="w-5 h-5" />
        {t('quiz_regenerate')}
      </Button>

      {hasIncorrectOrEmpty && (
        <Button
          type="button"
          onClick={onRetryMistakes}
          className="h-auto py-4 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02] hover:from-amber-500 hover:to-orange-500"
        >
          <TrendingUp className="w-5 h-5" />
          {t('quiz_retry_mistakes')}
        </Button>
      )}
    </div>
  )
}
