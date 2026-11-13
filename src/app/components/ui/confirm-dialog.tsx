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
      panelClassName="border-white/15 bg-zinc-900/95 px-6 py-5 shadow-2xl backdrop-blur-xl"
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel}>
          {resolvedCancelLabel}
        </Button>
        <Button
          variant={variant === 'destructive' ? 'ghost' : 'default'}
          size="sm"
          onClick={onConfirm}
          className={
            variant === 'destructive'
              ? 'border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : undefined
          }
        >
          {resolvedConfirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
