import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

export function SuccessBadge() {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      <motion.div
        key="success-badge"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.08 }}
        className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-2"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
        <span className="text-ql-11 font-semibold text-emerald-400/90">{t('ai_send_sent')}</span>
      </motion.div>
    </AnimatePresence>
  )
}

export function ErrorBadge() {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      <motion.div
        key="error-badge"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.08 }}
        className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-2"
      >
        <AlertCircle className="h-3.5 w-3.5 text-red-400" strokeWidth={2} />
        <span className="text-ql-11 font-semibold text-red-400/90">{t('ai_send_error')}</span>
      </motion.div>
    </AnimatePresence>
  )
}
