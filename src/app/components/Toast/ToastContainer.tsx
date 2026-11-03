import { useToastList } from '@app/providers'

import { AnimatePresence } from 'motion/react'
import { memo } from 'react'
import { createPortal } from 'react-dom'

import ToastItem from './ToastItem'

const ToastContainer = memo(function ToastContainer() {
  const { toasts, removeToast } = useToastList()

  const container = typeof document !== 'undefined' ? document.body : null

  if (!container) return null

  const errorToasts = toasts.filter((toast) => toast.type === 'error')
  const otherToasts = toasts.filter((toast) => toast.type !== 'error')

  return createPortal(
    // Errors live in their own assertive region: sharing the polite status
    // region meant a critical failure waited behind informational messages.
    <div
      id="toast-root"
      className="z-toast pointer-events-none fixed top-4 right-4 flex w-full max-w-[420px] flex-col items-end"
    >
      <div
        className="flex w-full flex-col items-end"
        aria-live="assertive"
        role="alert"
        data-testid="toast-region-error"
      >
        <AnimatePresence mode="popLayout">
          {errorToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      <div
        className="flex w-full flex-col items-end"
        aria-live="polite"
        role="status"
        data-testid="toast-region-polite"
      >
        <AnimatePresence mode="popLayout">
          {otherToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>,
    container
  )
})

export default ToastContainer
