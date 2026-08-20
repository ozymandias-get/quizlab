import { Button } from '@app/components/ui/button'
import { DURATION } from '@shared/lib/motion'

import { AlertTriangle, DownloadCloud, Monitor } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

function BrowserFallback() {
  const { t } = useTranslation()

  return (
    <div className="z-modal bg-background fixed inset-0 flex items-center justify-center overflow-hidden p-6">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: DURATION.slow, ease: 'easeOut' }}
        className="border-border bg-card shadow-ambient-xl relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border p-8 text-center"
      >
        <div className="border-primary/20 bg-primary/10 text-primary relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-xs">
          <Monitor className="h-8 w-8" />
          <AlertTriangle className="absolute -right-1.5 -bottom-1.5 h-6 w-6 rounded-md border border-amber-500/30 bg-amber-500/15 p-1 text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="text-ql-20 text-foreground mb-2 font-bold tracking-tight">
          {t('browser_fallback_title')}
        </h1>

        <p className="text-ql-13 text-muted-foreground mb-6 leading-relaxed">
          {t('browser_fallback_description')}
        </p>

        <div className="flex w-full flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => {
              window.location.href = 'https://github.com/ozymandias-get/quizlab'
            }}
            className="flex-1 gap-2"
          >
            <DownloadCloud className="h-4 w-4" />
            <span>{t('browser_fallback_download')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => window.location.reload()}
            className="flex-1 gap-2"
          >
            <span>{t('browser_fallback_retry')}</span>
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export default BrowserFallback
