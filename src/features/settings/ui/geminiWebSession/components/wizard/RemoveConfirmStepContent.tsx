import { Button } from '@app/components/ui/button'
import { IconBadge } from '@shared/ui/components/primitives'

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
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <IconBadge icon={Trash2} variant="danger" size="lg" className="mb-1" />
      <h3 id={titleId} className="text-ql-14 text-foreground font-semibold">
        {t('gws_extension_wizard_remove_title')}
      </h3>
      <p className="text-ql-13 text-muted-foreground">{t('gws_extension_wizard_remove_desc')}</p>

      <div className="mt-2 flex w-full items-center justify-center gap-2.5">
        <Button type="button" variant="outline" onClick={onClose}>
          <span className="text-ql-12">{t('gws_extension_wizard_cancel_btn')}</span>
        </Button>
        <Button type="button" variant="destructive" onClick={onRemove}>
          <span className="text-ql-12">{t('gws_extension_wizard_remove_confirm_btn')}</span>
        </Button>
      </div>
    </div>
  )
}

export default memo(RemoveConfirmStepContent)
