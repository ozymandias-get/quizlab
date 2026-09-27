import { motion } from 'motion/react'
import { memo } from 'react'

interface AppInfoSectionProps {
  t: (key: string) => string
  appVersion: string | null
}

const AppInfoSection = memo(({ t, appVersion }: AppInfoSectionProps) => {
  return (
    <header className="border-border/60 bg-card/30 flex flex-col items-center rounded-2xl border p-5">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-4"
      >
        <img
          src="/icon.png"
          alt=""
          aria-hidden
          className="border-border/60 size-16 rounded-xl border"
        />
      </motion.div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-ql-18 text-foreground tracking-ql-tight font-semibold">
          {t('app_name')}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-ql-10 tracking-ql-label font-semibold uppercase">
            {t('version')}
          </span>
          <span className="text-ql-12 border-border/60 bg-muted text-foreground rounded-lg border px-2 py-0.5 font-mono font-semibold">
            {appVersion}
          </span>
        </div>
      </div>
    </header>
  )
})

AppInfoSection.displayName = 'AppInfoSection'
export default AppInfoSection
