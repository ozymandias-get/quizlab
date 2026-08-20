import { Button } from '@app/components/ui/button'
import { useDialogBehavior } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'

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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default'
}: ConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)

  useDialogBehavior({
    isOpen,
    onClose: onCancel,
    dialogRef
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="z-modal bg-background/60 fixed inset-0 flex items-center justify-center p-4 backdrop-blur-md">
          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: DURATION.normal }}
            className="border-border shadow-ambient-xl bg-background w-full max-w-sm rounded-xl border px-6 py-5"
          >
            <h2 className="text-ql-15 text-foreground font-semibold">{title}</h2>
            {description && <p className="text-ql-13 text-muted-foreground mt-2">{description}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button variant={variant} size="sm" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
