import { useClipboard } from '@shared/hooks/useClipboard'

import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { memo } from 'react'

interface AppInfoSectionProps {
  t: (key: string) => string
  appVersion: string | null
}

const AppInfoSection = memo(({ t, appVersion }: AppInfoSectionProps) => {
  const { copy, isCopied } = useClipboard()

  return (
    <header className="flex flex-col items-center rounded-2xl border border-white/[0.07] bg-zinc-950/80 p-5">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-4"
      >
        <img
          // `BASE_URL` is `'/'` under the dev server and `'./'` in the packaged
          // build; an absolute `/icon.png` would resolve to the drive root once
          // the renderer is loaded over `file://`, leaving the logo blank.
          src={`${import.meta.env.BASE_URL}icon.png`}
          alt=""
          aria-hidden
          className="size-16 rounded-xl border border-white/[0.07]"
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
          <button
            type="button"
            onClick={() => {
              if (appVersion) void copy(appVersion)
            }}
            disabled={!appVersion}
            title={t('copy_version')}
            aria-label={t('copy_version')}
            className="text-ql-12 focus-visible:ring-ring/70 inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-zinc-800 px-2 py-0.5 font-mono font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {appVersion}
            {isCopied && <Check className="size-3 text-emerald-500" aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  )
})

AppInfoSection.displayName = 'AppInfoSection'
export default AppInfoSection
