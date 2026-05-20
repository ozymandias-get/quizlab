import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'

import { useToastList } from '@app/providers'
import ToastItem from './ToastItem'

function ToastContainer() {
  const { toasts, removeToast } = useToastList()

  const container = typeof document !== 'undefined' ? document.body : null

  if (!container) return null

  return createPortal(
    <div
      id="toast-root"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center pointer-events-none w-full max-w-md px-4"
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
}

export default ToastContainer
