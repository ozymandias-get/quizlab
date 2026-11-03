import { InlineSpinner } from '@shared/ui/components/primitives'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface LoadingContentProps {
  mode: 'install' | 'remove'
  /**
   * True while Escape/backdrop close is deliberately ignored. The wizard must
   * say so, otherwise the key looks broken.
   */
  closeBlocked?: boolean
}

function LoadingContent({ mode, closeBlocked = false }: LoadingContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <InlineSpinner size="xl" className="text-primary" />
      <p className="text-ql-13 text-muted-foreground text-center">
        {mode === 'install'
          ? t('ws_extension_wizard_installing')
          : t('ws_extension_wizard_removing')}
      </p>
      {closeBlocked && (
        <p role="status" className="text-ql-11 text-muted-foreground text-center">
          {t('ws_extension_wizard_loading_blocked')}
        </p>
      )}
    </div>
  )
}

export default memo(LoadingContent)
