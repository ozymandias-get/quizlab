import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GeminiIcon, LoaderIcon } from '@ui/components/Icons'

interface GeminiWebLoginOverlayProps {
  isVisible: boolean
  t: (key: string) => string
}

function GeminiWebLoginOverlay({ isVisible, t }: GeminiWebLoginOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="gemini-web-session-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-6 w-full max-w-xl rounded-[2rem] border border-white/[0.12] bg-white/[0.08] px-8 py-10 text-center shadow-[0_24px_120px_rgba(15,23,42,0.6)]"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              <div className="relative flex items-center justify-center">
                <GeminiIcon className="h-8 w-8" />
                <LoaderIcon className="absolute -right-4 -top-4 h-5 w-5 text-emerald-300" />
              </div>
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-200/70">
              {t('gws_toolbar_title')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{t('gws_overlay_title')}</h2>
            <p className="mt-3 text-sm leading-7 text-white/70">{t('gws_overlay_description')}</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-white/55">
              <LoaderIcon className="h-3.5 w-3.5" />
              <span>{t('gws_toolbar_checking')}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(GeminiWebLoginOverlay)
