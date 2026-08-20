import { InlineSpinner } from '@shared/ui/components/primitives'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const SettingsLoadingSpinner = memo(() => {
  const { t } = useTranslation()
  return (
    <div className="z-overlay bg-background/80 fixed inset-0 flex items-center justify-center backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <InlineSpinner size="xl" className="border-border border-t-primary" />
        <span className="text-ql-12 text-muted-foreground tracking-ql-caps font-medium uppercase">
          {t('loading')}
        </span>
      </div>
    </div>
  )
})

export default SettingsLoadingSpinner
