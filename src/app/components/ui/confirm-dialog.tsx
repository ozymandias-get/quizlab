import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@app/components/ui/dialog'
import type { ConfirmDialogProps } from '@shared/hooks/useConfirmDialog'
import { Button } from '@shared/ui/components/primitives'

import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default'
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const resolvedConfirmLabel = confirmLabel ?? t('confirm')
  const resolvedCancelLabel = cancelLabel ?? t('cancel')
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      role="alertdialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={description ? descriptionId : undefined}
      panelClassName="px-6 py-5"
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel}>
          {resolvedCancelLabel}
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          size="sm"
          onClick={onConfirm}
        >
          {resolvedConfirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
