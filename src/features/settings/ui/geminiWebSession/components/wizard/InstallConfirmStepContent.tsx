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
    <div className="flex flex-col gap-4 p-6 text-left">
      <h3 id={titleId} className="text-ql-14 text-foreground font-semibold">
        {t('gws_extension_wizard_install_title')}
      </h3>
      <p className="text-ql-13 text-muted-foreground">{t('gws_extension_wizard_install_desc')}</p>

      <div className="mt-2 flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onClose}>
          <span className="text-ql-12">{t('gws_extension_wizard_cancel_btn')}</span>
        </Button>
        <Button type="button" onClick={onInstall}>
          <span className="text-ql-12">{t('gws_extension_wizard_install_btn')}</span>
        </Button>
      </div>
    </div>
  )
}

export default memo(InstallConfirmStepContent)
