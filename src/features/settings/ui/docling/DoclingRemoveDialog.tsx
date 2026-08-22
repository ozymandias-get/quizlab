import { Button } from '@app/components/ui/button'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

const DoclingRemoveDialog = memo(function DoclingRemoveDialog({ open, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="docling-remove-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="bg-card border-border w-full max-w-md rounded-xl border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="docling-remove-title" className="text-foreground text-ql-14 font-semibold">
          {t('docling_remove_confirm_title')}
        </h4>
        <p className="text-muted-foreground text-ql-13 mt-2">{t('docling_remove_confirm_desc')}</p>
        <p className="text-muted-foreground text-ql-12 mt-1 font-medium">
          {t('docling_remove_confirm_note')}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('docling_cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          >
            {t('docling_confirm_remove')}
          </Button>
        </div>
      </div>
    </div>
  )
})

export default DoclingRemoveDialog
