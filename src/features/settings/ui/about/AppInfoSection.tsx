import { motion } from 'motion/react'
import { memo } from 'react'

interface AppInfoSectionProps {
  t: (key: string) => string
  appVersion: string | null
}

const AppInfoSection = memo(({ t, appVersion }: AppInfoSectionProps) => {
  return (
    <header className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative mb-5"
      >
        <img
          src="/icon.png"
          alt=""
          aria-hidden
          className="relative h-20 w-20 rounded-2xl border border-white/10 shadow-xl"
        />
      </motion.div>

      <div className="relative z-10 space-y-2 text-center">
        <h3 className="text-ql-18 font-semibold tracking-tight text-white/90">{t('app_name')}</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-ql-10 tracking-ql-fine font-medium text-white/40">
            {t('version')}
          </span>
          <span className="text-ql-12 rounded-lg border border-white/[0.12] bg-white/[0.08] px-2.5 py-0.5 font-mono font-bold text-white">
            {appVersion}
          </span>
        </div>
      </div>
    </header>
  )
})

AppInfoSection.displayName = 'AppInfoSection'
export default AppInfoSection
