import { Button } from '@app/components/ui/button'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface InstallConfirmStepContentProps {
  onInstall: () => void
  onClose: () => void
  titleId: string
}

function InstallConfirmStepContent({
  onInstall,
  onClose,
  titleId
}: InstallConfirmStepContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col px-8 pt-4 pb-8 text-left">
      <h3 id={titleId} className="text-ql-15 text-foreground font-semibold">
        {t('gws_extension_wizard_install_title')}
      </h3>
      <p className="text-ql-13 text-muted-foreground mt-2">
        {t('gws_extension_wizard_install_desc')}
      </p>

      <div className="mt-8 flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onClose} className="text-ql-12">
          {t('gws_extension_wizard_cancel_btn')}
        </Button>
        <Button type="button" onClick={onInstall} className="text-ql-12 shadow-xs">
          {t('gws_extension_wizard_install_btn')}
        </Button>
      </div>
    </div>
  )
}

export default memo(InstallConfirmStepContent)
