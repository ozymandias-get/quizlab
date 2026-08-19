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
      <div className="bg-destructive/15 mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <Trash2 className="text-destructive h-6 w-6" />
      </div>
      <h3 id={titleId} className="text-ql-16 text-foreground font-semibold">
        {t('gws_extension_wizard_remove_title')}
      </h3>
      <p className="text-ql-13 text-muted-foreground mt-2">
        {t('gws_extension_wizard_remove_desc')}
      </p>

      <div className="mt-8 flex w-full items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="text-ql-12 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg border px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_cancel_btn')}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-ql-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40 inline-flex items-center justify-center rounded-lg px-5 py-2 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_remove_confirm_btn')}
        </button>
      </div>
    </div>
  )
}

export default memo(RemoveConfirmStepContent)
