import {
  useCallback,
  useEffect,
  useState,
  useRef,
  forwardRef,
  type MouseEvent,
  type ReactNode
} from 'react'
import { motion } from 'framer-motion'
import { useLanguageStrings, type Toast } from '@app/providers'

type ToastType = Toast['type']

const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  error: (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ),
  warning: (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  info: (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  )
}

const STYLES: Record<ToastType, string> = {
  success:
    'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-[0_4px_24px_-4px_rgba(16,185,129,0.15)]',
  error:
    'bg-red-500/10 text-red-300 border border-red-500/20 shadow-[0_4px_24px_-4px_rgba(239,68,68,0.15)]',
  warning:
    'bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-[0_4px_24px_-4px_rgba(245,158,11,0.15)]',
  info: 'bg-blue-500/10 text-blue-300 border border-blue-500/20 shadow-[0_4px_24px_-4px_rgba(59,130,246,0.15)]'
}

const ACCENT_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500'
}

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500'
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastItem = forwardRef<HTMLDivElement, ToastItemProps>(({ toast, onRemove }, ref) => {
  const { t } = useLanguageStrings()
  const [isPaused, setIsPaused] = useState(false)
  const [progressPercent, setProgressPercent] = useState(100)
  const [resumeKey, setResumeKey] = useState(0)
  const remainingTimeRef = useRef(toast.duration || 5000)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerStartRef = useRef<number>(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const duration = toast.duration || 5000
  const toastId = toast.id

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressRef.current !== null) {
      clearInterval(progressRef.current)
      progressRef.current = null
    }
  }, [])

  const startProgress = useCallback(() => {
    if (progressRef.current !== null) {
      clearInterval(progressRef.current)
    }
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current
      const remaining = Math.max(0, remainingTimeRef.current - elapsed)
      const percent = (remaining / duration) * 100
      setProgressPercent(percent)
    }, 16)
  }, [duration])

  const startTimer = useCallback(() => {
    clearTimer()
    timerStartRef.current = Date.now()
    startProgress()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      onRemove(toastId)
    }, remainingTimeRef.current)
  }, [clearTimer, toastId, onRemove, startProgress])

  useEffect(() => {
    if (!isPaused) {
      startTimer()
    }
    return () => {
      clearTimer()
    }
  }, [isPaused, startTimer, clearTimer])

  const handleMouseEnter = () => {
    setIsPaused(true)
    const elapsed = Date.now() - timerStartRef.current
    const remaining = remainingTimeRef.current - elapsed
    remainingTimeRef.current = Math.max(0, remaining)
    clearTimer()
  }

  const handleMouseLeave = () => {
    setIsPaused(false)
    setResumeKey((k) => k + 1)
  }

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation()
    onRemove(toast.id)
  }

  const handleAction = (e: MouseEvent) => {
    e.stopPropagation()
    try {
      toast.onAction?.()
    } finally {
      onRemove(toast.id)
    }
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: -16,
        scale: 0.96,
        transition: { duration: 0.2, ease: 'easeOut' }
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative group pointer-events-auto
        w-full p-3.5 mb-2 rounded-xl
        backdrop-blur-md
        flex items-start gap-3
        ${STYLES[toast.type] || STYLES.info}
      `}
    >
      <div
        className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${ACCENT_COLORS[toast.type] || ACCENT_COLORS.info}`}
      />

      <div className="flex-shrink-0 mt-0.5">{ICONS[toast.type] || ICONS.info}</div>

      <div className="flex-grow min-w-0 pr-5">
        <h4 className="text-sm font-semibold mb-0.5 truncate">
          {toast.title ? t(toast.title, toast.params) : t(`toast.${toast.type}.title`)}
        </h4>
        <p className="text-xs opacity-80 leading-relaxed break-words line-clamp-2">
          {t(toast.message, toast.params)}
        </p>
        {toast.actionLabel && (
          <button
            type="button"
            onClick={handleAction}
            className="mt-1.5 text-xs font-semibold uppercase tracking-wide opacity-90 hover:opacity-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm"
          >
            {t(toast.actionLabel)}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="absolute top-2 right-2 flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/5"
        aria-label="Close notification"
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-black/20 rounded-full overflow-hidden">
        <motion.div
          key={resumeKey}
          className={`h-full ${PROGRESS_COLORS[toast.type] || PROGRESS_COLORS.info}`}
          style={{
            width: `${progressPercent}%`
          }}
        />
      </div>
    </motion.div>
  )
})

export default ToastItem
