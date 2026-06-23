import { AlertTriangle, DownloadCloud, Monitor } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

function BrowserFallback() {
  const { t } = useTranslation()

  return (
    <div className="z-top fixed inset-0 flex items-center justify-center overflow-hidden bg-zinc-950 p-6">
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[40%] w-[40%] rounded-full bg-purple-600/20 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-lg flex-col items-center overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10"
      >
        <div className="absolute top-0 left-1/2 h-[1px] w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />

        <motion.div
          initial={{ rotate: -10 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/5 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-inner">
            <Monitor className="h-12 w-12 text-blue-400 opacity-90" />
            <AlertTriangle className="absolute -right-2 -bottom-2 h-10 w-10 rounded-lg border border-white/10 bg-zinc-900 p-1.5 text-amber-400" />
          </div>
        </motion.div>

        <h1 className="text-ql-20 sm:text-ql-28 mb-4 font-bold tracking-tight text-white">
          {t('browser_fallback_title')}
        </h1>

        <p className="mb-8 leading-relaxed text-zinc-400">{t('browser_fallback_description')}</p>

        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              window.location.href = 'https://github.com/ozymandias-get/quizlab'
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-medium text-zinc-950 transition-colors hover:bg-zinc-200 active:bg-zinc-300"
          >
            <DownloadCloud className="h-4 w-4" />
            {t('browser_fallback_download')}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-white transition-colors hover:bg-white/10"
          >
            {t('browser_fallback_retry')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default BrowserFallback
