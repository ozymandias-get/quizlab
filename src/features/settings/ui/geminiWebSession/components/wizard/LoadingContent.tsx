import { InlineSpinner } from '@shared/ui/components/primitives'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface LoadingContentProps {
  mode: 'install' | 'remove'
}

function LoadingContent({ mode }: LoadingContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <InlineSpinner size="xl" className="text-primary" />
      <p className="text-ql-13 text-muted-foreground">
        {mode === 'install'
          ? t('gws_extension_wizard_installing')
          : t('gws_extension_wizard_removing')}
      </p>
    </div>
  )
}

export default memo(LoadingContent)
