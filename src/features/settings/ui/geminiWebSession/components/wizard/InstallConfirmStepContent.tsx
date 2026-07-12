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
      <h3 id={titleId} className="text-ql-16 font-semibold text-white">
        {t('gws_extension_wizard_install_title')}
      </h3>
      <p className="text-ql-13 mt-2 text-white/50">{t('gws_extension_wizard_install_desc')}</p>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-ql-13 rounded-full px-5 py-2.5 font-medium text-white/60 transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_cancel_btn')}
        </button>
        <button
          type="button"
          onClick={onInstall}
          className="text-ql-13 inline-flex items-center justify-center rounded-full bg-emerald-400/90 px-6 py-2.5 font-semibold text-white transition-all hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_install_btn')}
        </button>
      </div>
    </div>
  )
}

export default memo(InstallConfirmStepContent)
