import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const SettingsLoadingSpinner = memo(() => {
  const { t } = useTranslation()
  return (
    <div className="z-overlay bg-background/80 fixed inset-0 flex items-center justify-center backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
        <span className="text-ql-12 text-muted-foreground font-medium tracking-wider uppercase">
          {t('loading')}
        </span>
      </div>
    </div>
  )
})

export default SettingsLoadingSpinner
