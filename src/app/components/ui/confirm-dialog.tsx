import { Button } from '@app/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@app/components/ui/dialog'

import { useTranslation } from 'react-i18next'

export interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

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
  const resolvedConfirmLabel = confirmLabel ?? t('confirm')
  const resolvedCancelLabel = cancelLabel ?? t('cancel')
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      role="alertdialog"
      panelClassName="px-6 py-5"
    >
      <DialogTitle>{title}</DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
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
