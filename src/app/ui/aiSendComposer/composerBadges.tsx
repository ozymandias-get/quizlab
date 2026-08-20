import { DURATION } from '@shared/lib/motion'

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
        transition={{ duration: DURATION.fast }}
        className="border-border flex items-center justify-center gap-2 border-t px-4 py-2"
      >
        <CheckCircle2
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2}
        />
        <span className="text-ql-11 font-semibold text-emerald-600 dark:text-emerald-400">
          {t('ai_send_sent')}
        </span>
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
        transition={{ duration: DURATION.fast }}
        className="border-border flex items-center justify-center gap-2 border-t px-4 py-2"
      >
        <AlertCircle className="text-destructive h-3.5 w-3.5" strokeWidth={2} />
        <span className="text-ql-11 text-destructive font-semibold">{t('ai_send_error')}</span>
      </motion.div>
    </AnimatePresence>
  )
}
