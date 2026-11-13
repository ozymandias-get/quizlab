import { Button } from '@shared/ui/components/primitives'

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
    <div className="animate-in fade-in zoom-in motion-slower absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/95">
      <div className="flex max-w-sm flex-col items-center gap-4 p-8 text-center">
        {/* The glyph is a quiet marker, not the message: a calmer 48px disc so
            the eye lands on the title first. */}
        <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive/80 h-6 w-6" strokeWidth={1.75} />
        </div>
        <h3 className="font-display text-ql-16 text-foreground font-semibold">
          {t('ai_error_title', { name: aiName || 'AI' })}
        </h3>
        <p className="text-ql-12 text-muted-foreground leading-relaxed">{error}</p>
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
