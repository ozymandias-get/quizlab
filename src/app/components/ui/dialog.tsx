import { useDialogBehavior } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'

import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'

/** Shared backdrop — single source of truth for every modal/dialog in the app. */
export function DialogBackdrop({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'z-modal bg-background/60 fixed inset-0 flex items-center justify-center p-4 backdrop-blur-md',
        className
      )}
      {...props}
    />
  )
}

type DialogPanelSize = 'sm' | 'md' | 'lg' | 'fullscreen'

const panelSizeClasses: Record<DialogPanelSize, string> = {
  sm: 'w-full max-w-sm rounded-2xl',
  md: 'w-full max-w-xl rounded-2xl',
  lg: 'w-full max-w-2xl rounded-2xl',
  fullscreen: 'h-full w-full rounded-none border-0'
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-ql-15 text-foreground font-semibold', className)} {...props} />
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-ql-13 text-muted-foreground mt-2', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
}

/**
 * Headless dialog wrapper that wires useDialogBehavior (Escape, focus trap,
 * body scroll lock, focus restore) and the standard backdrop + motion.
 * For simple confirm-style dialogs use <Dialog> directly; for complex
 * custom modals (History, Settings) compose Backdrop + Panel manually.
 */
interface DialogProps {
  isOpen: boolean
  onClose: () => void
  size?: DialogPanelSize
  role?: 'dialog' | 'alertdialog'
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  children: React.ReactNode
  panelClassName?: string
}

export function Dialog({
  isOpen,
  onClose,
  size = 'sm',
  role = 'dialog',
  ariaLabelledBy,
  ariaDescribedBy,
  children,
  panelClassName
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  useDialogBehavior({ isOpen, onClose, dialogRef })

  return (
    <AnimatePresence>
      {isOpen && (
        <DialogBackdrop onClick={onClose}>
          <motion.div
            ref={dialogRef}
            role={role}
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: DURATION.normal }}
            className={cn(
              panelSizeClasses[size],
              'border-border shadow-ambient-xl bg-background border',
              size !== 'fullscreen' && 'rounded-2xl',
              panelClassName
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </DialogBackdrop>
      )}
    </AnimatePresence>
  )
}
