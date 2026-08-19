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
    <div className="animate-in fade-in zoom-in bg-background/95 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-md duration-300">
      <div className="flex max-w-xs flex-col items-center gap-5 p-10 text-center">
        <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive h-8 w-8" />
        </div>
        <h3 className="font-display text-ql-20 text-foreground font-semibold">
          {t('ai_error_title', { name: aiName || 'AI' })}
        </h3>
        <p className="text-ql-14 text-muted-foreground leading-relaxed">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="border-border text-foreground hover:bg-muted mt-2 flex items-center gap-2 rounded-full px-6 py-2"
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
