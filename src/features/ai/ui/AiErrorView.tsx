import { Button } from '@app/components/ui/button'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface AiErrorViewProps {
  error: string
  onRetry: () => void
  aiName?: string
}

const AiErrorView = memo(({ error, onRetry, aiName }: AiErrorViewProps) => {
  const { t } = useTranslation()

  return (
    <div className="animate-in fade-in zoom-in absolute inset-0 z-10 flex items-center justify-center bg-stone-900/95 backdrop-blur-sm duration-300">
      <div className="flex max-w-xs flex-col items-center gap-5 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="h-8 w-8 text-red-400/80" />
        </div>
        <h3 className="font-display text-ql-20 font-semibold text-stone-200">
          {t('ai_error_title', { name: aiName || 'AI' })}
        </h3>
        <p className="text-ql-14 leading-relaxed text-stone-500">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-2 flex items-center gap-2 rounded-full border-white/10 px-6 py-2 text-stone-200 hover:bg-white/5"
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t('try_again')}</span>
        </Button>
      </div>
    </div>
  )
})

AiErrorView.displayName = 'AiErrorView'
export default AiErrorView
