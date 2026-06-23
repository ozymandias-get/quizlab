import { type Toast } from '@app/providers'
import { cn } from '@shared/lib/uiUtils'

import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import {
  forwardRef,
  memo,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

type ToastType = Toast['type']

const ICONS: Record<ToastType, ReactNode> = {
  success: <Check className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />
}

const STYLES: Record<ToastType, string> = {
  success:
    'bg-emerald-500/[0.85] text-emerald-50 border border-emerald-500/50 shadow-[0_8px_32px_-8px_rgba(16,185,129,0.4),0_0_0_1px_rgba(16,185,129,0.25)]',
  error:
    'bg-red-500/[0.85] text-red-50 border border-red-500/50 shadow-[0_8px_32px_-8px_rgba(239,68,68,0.4),0_0_0_1px_rgba(239,68,68,0.25)]',
  warning:
    'bg-amber-500/[0.85] text-amber-50 border border-amber-500/50 shadow-[0_8px_32px_-8px_rgba(245,158,11,0.4),0_0_0_1px_rgba(245,158,11,0.25)]',
  info: 'bg-blue-500/[0.85] text-blue-50 border border-blue-500/50 shadow-[0_8px_32px_-8px_rgba(59,130,246,0.4),0_0_0_1px_rgba(59,130,246,0.25)]'
}

const ACCENT_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500'
}

const ICON_BG: Record<ToastType, string> = {
  success: 'bg-emerald-500/45 text-emerald-50',
  error: 'bg-red-500/45 text-red-50',
  warning: 'bg-amber-500/45 text-amber-50',
  info: 'bg-blue-500/45 text-blue-50'
}

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-400/90',
  error: 'bg-red-400/90',
  warning: 'bg-amber-400/90',
  info: 'bg-blue-400/90'
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastItem = memo(
  forwardRef<HTMLDivElement, ToastItemProps>(({ toast, onRemove }, ref) => {
    const { t } = useTranslation()
    const [isPaused, setIsPaused] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [animationKey, setAnimationKey] = useState(0)
    const remainingTimeRef = useRef(toast.duration || 5000)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const timerStartRef = useRef<number>(0)

    const toastId = toast.id

    const clearTimer = useCallback(() => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }, [])

    const startTimer = useCallback(() => {
      clearTimer()
      timerStartRef.current = Date.now()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        onRemove(toastId)
      }, remainingTimeRef.current)
    }, [clearTimer, toastId, onRemove])

    useEffect(() => {
      if (!isPaused) {
        startTimer()
      }
      return () => {
        clearTimer()
      }
    }, [isPaused, startTimer, clearTimer])

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true)
      setIsPaused(true)
      const elapsed = Date.now() - timerStartRef.current
      const remaining = remainingTimeRef.current - elapsed
      remainingTimeRef.current = Math.max(0, remaining)
      clearTimer()
    }, [clearTimer])

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false)
      setIsPaused(false)
      setAnimationKey((k) => k + 1)
    }, [])

    const handleClose = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation()
        onRemove(toast.id)
      },
      [onRemove, toast.id]
    )

    const handleAction = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation()
        try {
          toast.onAction?.()
        } finally {
          onRemove(toast.id)
        }
      },
      [onRemove, toast.id, toast.onAction]
    )

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: -12,
          scale: 0.95,
          transition: { duration: 0.18, ease: 'easeOut' }
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.7 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'group pointer-events-auto relative',
          'mb-2 w-full overflow-hidden rounded-xl',
          'flex items-start gap-0',
          'transition-colors duration-200 ease-out',
          isHovered && 'scale-[1.015] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]',
          STYLES[toast.type] || STYLES.info
        )}
      >
        <div
          className={cn(
            'absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full',
            ACCENT_COLORS[toast.type] || ACCENT_COLORS.info
          )}
        />

        <div className="flex w-full items-start gap-3 py-3 pr-3 pl-4">
          <div
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              ICON_BG[toast.type] || ICON_BG.info
            )}
          >
            {ICONS[toast.type] || ICONS.info}
          </div>

          <div className="min-w-0 grow pr-4">
            <h4 className="text-ql-13 mb-0.5 leading-tight font-semibold tracking-tight">
              {toast.title ? t(toast.title, toast.params) : t(`toast.${toast.type}.title`)}
            </h4>
            <p className="text-ql-12 line-clamp-2 leading-relaxed break-words opacity-75">
              {t(toast.message, toast.params)}
            </p>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={handleAction}
                className="text-ql-11 mt-1.5 rounded-sm px-0.5 font-semibold tracking-wider uppercase underline decoration-white/30 underline-offset-2 opacity-80 transition-opacity hover:decoration-white/50 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
              >
                {t(toast.actionLabel)}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="mt-0.5 shrink-0 rounded-md p-1 opacity-0 transition-colors duration-150 group-hover:opacity-50 hover:bg-white/10 hover:!opacity-100 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
            aria-label={t('close_notification')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="absolute right-0 bottom-0 left-0 h-[2px] bg-white/[0.04]">
          <div
            key={animationKey}
            className={cn('h-full', PROGRESS_COLORS[toast.type] || PROGRESS_COLORS.info)}
            style={{
              width: '100%',
              transformOrigin: 'left',
              animation: isPaused
                ? 'none'
                : `toast-progress-shrink ${remainingTimeRef.current}ms linear forwards`
            }}
          />
        </div>
      </motion.div>
    )
  })
)

export default ToastItem
ToastItem.displayName = 'ToastItem'
