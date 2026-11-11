import { useToastList } from '@app/providers'

import { AnimatePresence, motion } from 'motion/react'
import { memo } from 'react'
import { createPortal } from 'react-dom'

import ToastItem from './ToastItem'

const ToastContainer = memo(function ToastContainer() {
  const { toasts, removeToast } = useToastList()

  const container = typeof document !== 'undefined' ? document.body : null

  if (!container) return null

  const errorToasts = toasts.filter((toast) => toast.type === 'error')
  const otherToasts = toasts.filter((toast) => toast.type !== 'error')

  /**
   * Deck layout: the newest card sits in front and older cards peek out from
   * behind, scaled and lifted slightly. Only three are kept on screen, so a
   * burst of warnings can never cover half of the workspace.
   */
  const renderStack = (list: typeof toasts) => (
    <div className="grid w-full">
      <AnimatePresence mode="popLayout">
        {list.slice(-3).map((toast, index, visible) => {
          const depth = visible.length - 1 - index
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{
                opacity: depth === 0 ? 1 : 0.85 - depth * 0.12,
                y: depth * -8,
                scale: 1 - depth * 0.04
              }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{
                gridArea: '1 / 1',
                zIndex: 30 - depth,
                transformOrigin: 'top center',
                pointerEvents: depth === 0 ? 'auto' : 'none'
              }}
            >
              <ToastItem toast={toast} onRemove={removeToast} paused={depth > 0} />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )

  return createPortal(
    // Errors live in their own assertive region: sharing the polite status
    // region meant a critical failure waited behind informational messages.
    <div
      id="toast-root"
      className="z-toast pointer-events-none fixed top-4 right-4 flex w-[calc(100vw-2rem)] max-w-[420px] flex-col items-end"
    >
      <div
        className="flex w-full flex-col items-end"
        aria-live="assertive"
        role="alert"
        data-testid="toast-region-error"
      >
        {renderStack(errorToasts)}
      </div>

      <div
        className="flex w-full flex-col items-end"
        aria-live="polite"
        role="status"
        data-testid="toast-region-polite"
      >
        {renderStack(otherToasts)}
      </div>
    </div>,
    container
  )
})

export default ToastContainer
