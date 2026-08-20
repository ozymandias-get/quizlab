import { motion } from 'motion/react'
import { memo } from 'react'

interface AppInfoSectionProps {
  t: (key: string) => string
  appVersion: string | null
}

const AppInfoSection = memo(({ t, appVersion }: AppInfoSectionProps) => {
  return (
    <header className="border-border bg-card relative flex flex-col items-center overflow-hidden rounded-xl border p-6 shadow-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative mb-4"
      >
        <img
          src="/icon.png"
          alt=""
          aria-hidden
          className="border-border relative h-16 w-16 rounded-xl border shadow-xs"
        />
      </motion.div>

      <div className="relative z-10 space-y-1.5 text-center">
        <h3 className="text-ql-18 text-foreground tracking-ql-tight font-bold">{t('app_name')}</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-ql-10 text-muted-foreground tracking-ql-caps font-medium uppercase">
            {t('version')}
          </span>
          <span className="text-ql-12 border-border bg-muted/60 text-foreground rounded-md border px-2 py-0.5 font-mono font-semibold">
            {appVersion}
          </span>
        </div>
      </div>
    </header>
  )
})

AppInfoSection.displayName = 'AppInfoSection'
export default AppInfoSection
