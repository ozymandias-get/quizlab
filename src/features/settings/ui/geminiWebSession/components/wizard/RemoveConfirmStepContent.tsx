import { Button } from '@app/components/ui/button'

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
      <h3 id={titleId} className="text-ql-15 text-foreground font-semibold">
        {t('gws_extension_wizard_remove_title')}
      </h3>
      <p className="text-ql-13 text-muted-foreground mt-2">
        {t('gws_extension_wizard_remove_desc')}
      </p>

      <div className="mt-8 flex w-full items-center justify-center gap-2.5">
        <Button type="button" variant="outline" onClick={onClose} className="text-ql-12">
          {t('gws_extension_wizard_cancel_btn')}
        </Button>
        <Button type="button" variant="destructive" onClick={onRemove} className="text-ql-12">
          {t('gws_extension_wizard_remove_confirm_btn')}
        </Button>
      </div>
    </div>
  )
}

export default memo(RemoveConfirmStepContent)
