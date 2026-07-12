import { Trash2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface RemoveConfirmStepContentProps {
  onRemove: () => void
  onClose: () => void
  titleId: string
}

function RemoveConfirmStepContent({ onRemove, onClose, titleId }: RemoveConfirmStepContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center px-8 pt-4 pb-8 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-400/20">
        <Trash2 className="h-7 w-7 text-red-400" />
      </div>
      <h3 id={titleId} className="text-ql-16 font-semibold text-white">
        {t('gws_extension_wizard_remove_title')}
      </h3>
      <p className="text-ql-13 mt-2 text-white/50">{t('gws_extension_wizard_remove_desc')}</p>

      <div className="mt-8 flex w-full items-center justify-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-ql-13 rounded-full px-5 py-2.5 font-medium text-white/60 transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_cancel_btn')}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-ql-13 inline-flex items-center justify-center rounded-full bg-red-400/90 px-6 py-2.5 font-semibold text-white transition-all hover:bg-red-400 focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_remove_confirm_btn')}
        </button>
      </div>
    </div>
  )
}

export default memo(RemoveConfirmStepContent)
