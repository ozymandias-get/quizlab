import { useToastList } from '@app/providers'

import { AnimatePresence } from 'motion/react'
import { memo } from 'react'
import { createPortal } from 'react-dom'

import ToastItem from './ToastItem'

const ToastContainer = memo(function ToastContainer() {
  const { toasts, removeToast } = useToastList()

  const container = typeof document !== 'undefined' ? document.body : null

  if (!container) return null

  return createPortal(
    <div
      id="toast-root"
      className="z-max pointer-events-none fixed top-4 right-4 flex w-full max-w-[420px] flex-col items-end"
      aria-live="polite"
      role="status"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>,
    container
  )
})

export default ToastContainer
