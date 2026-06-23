import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const SettingsLoadingSpinner = memo(() => {
  const { t } = useTranslation()
  return (
    <div className="z-overlay fixed inset-0 flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
        <span className="text-ql-12 font-medium tracking-wider text-white/50 uppercase">
          {t('loading')}
        </span>
      </div>
    </div>
  )
})
