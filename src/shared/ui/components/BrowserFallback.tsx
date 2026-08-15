import { AlertTriangle, DownloadCloud, Monitor } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

function BrowserFallback() {
  const { t } = useTranslation()

  return (
    <div className="z-top bg-background fixed inset-0 flex items-center justify-center overflow-hidden p-6">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="border-border bg-card shadow-ambient-xl relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border p-8 text-center"
      >
        <div className="border-primary/20 bg-primary/10 text-primary relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-xs">
          <Monitor className="h-8 w-8" />
          <AlertTriangle className="absolute -right-1.5 -bottom-1.5 h-6 w-6 rounded-md border border-amber-500/30 bg-amber-500/15 p-1 text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="text-ql-20 text-foreground mb-2 font-bold tracking-tight">
          {t('browser_fallback_title')}
        </h1>

        <p className="text-ql-14 text-muted-foreground mb-6 leading-relaxed">
          {t('browser_fallback_description')}
        </p>

        <div className="flex w-full flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              window.location.href = 'https://github.com/ozymandias-get/quizlab'
            }}
            className="text-ql-13 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <DownloadCloud className="h-4 w-4" />
            {t('browser_fallback_download')}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-ql-13 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {t('browser_fallback_retry')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default BrowserFallback
