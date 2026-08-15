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
      <h3 id={titleId} className="text-ql-16 text-foreground font-semibold">
        {t('gws_extension_wizard_install_title')}
      </h3>
      <p className="text-ql-13 text-muted-foreground mt-2">
        {t('gws_extension_wizard_install_desc')}
      </p>

      <div className="mt-8 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="text-ql-12 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg border px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_cancel_btn')}
        </button>
        <button
          type="button"
          onClick={onInstall}
          className="text-ql-12 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 inline-flex items-center justify-center rounded-lg px-5 py-2 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_install_btn')}
        </button>
      </div>
    </div>
  )
}

export default memo(InstallConfirmStepContent)
