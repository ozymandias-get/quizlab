import type { Toast } from '@app/providers'
import { TOAST_DURATION } from '@shared/constants/appConstants'
import { getElectronApi } from '@shared/lib/electronApi'
import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'
import { Button, IconButton } from '@shared/ui/components/primitives'

import { AlertTriangle, Check, ExternalLink, Info, X, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import {
  type FocusEvent,
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

const TOAST_SURFACE =
  'border border-white/12 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur-xl'

const STYLES: Record<ToastType, string> = {
  success: TOAST_SURFACE,
  error: TOAST_SURFACE,
  warning: TOAST_SURFACE,
  info: TOAST_SURFACE
}

const ACCENT_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-destructive',
  warning: 'bg-amber-500',
  info: 'bg-primary'
}

const ICON_BG: Record<ToastType, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  error: 'bg-destructive/10 text-destructive border border-destructive/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  info: 'bg-primary/10 text-primary border border-primary/20'
}

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500/70',
  error: 'bg-destructive/70',
  warning: 'bg-amber-500/70',
  info: 'bg-primary/70'
}

/**
 * URLs and file paths are the two "actionable" fragments a diagnostic toast
 * carries. URLs open through the Electron bridge; paths stay selectable code
 * rather than becoming a link that could launch an unintended handler.
 */
const TOAST_LINK_PATTERN =
  /(https?:\/\/[^\s<>"']+|[A-Za-z]:\\[^\s<>"']+|\/(?:Users|home|var|etc|tmp|opt|mnt|private)\/[^\s<>"']+)/g

const SENTENCE_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?'])
/** Closing brackets only belong to the prose when they have no opener inside the target. */
const CLOSING_BRACKETS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

function countChar(value: string, char: string): number {
  let count = 0
  for (const current of value) if (current === char) count += 1
  return count
}

/**
 * Split a raw match into the actionable target and the punctuation that must
 * stay in the sentence. Stripping used to *drop* the punctuation, so the toast
 * showed a different sentence than the one the diagnostic produced; a closing
 * bracket that is genuinely part of a URL (Wikipedia-style `/Foo_(bar)`) must
 * survive, while a sentence-closing one must not.
 */
function splitTrailingPunctuation(raw: string): { value: string; punctuation: string } {
  let end = raw.length
  while (end > 0) {
    const char = raw[end - 1]
    if (SENTENCE_PUNCTUATION.has(char)) {
      end -= 1
      continue
    }
    const opener = CLOSING_BRACKETS[char]
    if (!opener) break
    const candidate = raw.slice(0, end)
    if (countChar(candidate, opener) >= countChar(candidate, char)) break
    end -= 1
  }
  return { value: raw.slice(0, end), punctuation: raw.slice(end) }
}

function renderToastMessage(text: string): ReactNode {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(TOAST_LINK_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(text.slice(cursor, index))
    const raw = match[0]
    const { value, punctuation } = splitTrailingPunctuation(raw)
    if (!value) {
      nodes.push(raw)
    } else if (/^https?:\/\//.test(value)) {
      nodes.push(
        <button
          key={`${index}-link`}
          type="button"
          role="link"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void getElectronApi()?.openExternal(value)
          }}
          className="text-primary focus-visible:ring-ring/70 inline-flex items-center gap-0.5 break-all underline underline-offset-2 hover:opacity-80 focus-visible:rounded focus-visible:ring-2 focus-visible:outline-none"
        >
          {value}
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </button>
      )
      if (punctuation) nodes.push(punctuation)
    } else {
      nodes.push(
        <code
          key={`${index}-path`}
          title={value}
          className="text-ql-11 rounded border border-white/[0.07] bg-white/[0.06] px-1 py-0.5 font-mono break-all select-all"
        >
          {value}
        </code>
      )
      if (punctuation) nodes.push(punctuation)
    }
    cursor = index + raw.length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes.length > 0 ? nodes : text
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
  /** Background cards in the stack cannot be hovered, so their timer pauses too. */
  paused?: boolean
}

const ToastItem = memo(
  forwardRef<HTMLDivElement, ToastItemProps>(({ toast, onRemove, paused = false }, ref) => {
    const { t } = useTranslation()
    const [isHovered, setIsHovered] = useState(false)
    const [isFocusWithin, setIsFocusWithin] = useState(false)
    const [animationKey, setAnimationKey] = useState(0)
    // `??` is deliberate: duration 0 means "stay until dismissed", while an
    // omitted duration falls back to the standard toast lifetime. `||` would
    // silently turn the former into the latter.
    const configuredDuration = toast.duration ?? TOAST_DURATION.DEFAULT
    const isPersistent = configuredDuration <= 0
    const remainingTimeRef = useRef(configuredDuration)
    // Identifies which (toast, duration) pair the timer currently represents,
    // so a duration update is applied once and does not fight pause/resume.
    const appliedDurationRef = useRef(`${toast.id}:${configuredDuration}`)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const timerStartRef = useRef<number>(0)

    const toastId = toast.id
    // Pointer and keyboard both keep the toast alive: a user tabbing to the
    // close/action button must not lose it mid-interaction.
    const isPaused = paused || isHovered || isFocusWithin
    // A demoted card leaves the tab order and the accessibility tree, but only
    // while focus is not inside it. Making a focused subtree inert drops focus
    // to <body>; the card that the user was already interacting with therefore
    // stays live until they leave it on their own.
    const isBackgrounded = paused && !isFocusWithin

    const clearTimer = useCallback(() => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }, [])

    const startTimer = useCallback(() => {
      clearTimer()
      if (isPersistent) return
      timerStartRef.current = Date.now()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        onRemove(toastId)
      }, remainingTimeRef.current)
    }, [clearTimer, isPersistent, toastId, onRemove])

    const pauseTimer = useCallback(() => {
      // Cleanup runs before the paused effect, so the remaining time has to be
      // captured here while the timeout is still live.
      if (timerRef.current === null) return
      const elapsed = Date.now() - timerStartRef.current
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed)
      clearTimer()
    }, [clearTimer])

    const resumeTimer = useCallback(() => {
      // The timeout alone restarts. The progress bar is not remounted: it kept
      // its CSS animation paused in place, so a new key would jump it back to
      // 100% while only the remaining time is actually left.
      startTimer()
    }, [startTimer])

    useEffect(() => {
      if (isPaused) {
        pauseTimer()
        return
      }
      resumeTimer()
    }, [isPaused, pauseTimer, resumeTimer])

    // A toast can be re-rendered with a new duration while keeping its id
    // (for example when preferences change). Restart from the new duration
    // instead of silently keeping the old remaining time.
    useEffect(() => {
      const key = `${toast.id}:${configuredDuration}`
      if (appliedDurationRef.current === key) return
      appliedDurationRef.current = key
      remainingTimeRef.current = configuredDuration
      setAnimationKey((animation) => animation + 1)
      if (!isPaused) startTimer()
    }, [configuredDuration, isPaused, startTimer, toast.id])

    // Unmount (or a toast id swap) is the only reason to drop the timeout.
    useEffect(() => () => clearTimer(), [clearTimer])

    const handleMouseEnter = useCallback(() => setIsHovered(true), [])
    const handleMouseLeave = useCallback(() => setIsHovered(false), [])

    const handleFocusCapture = useCallback(() => setIsFocusWithin(true), [])
    const handleBlurCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
      // Moving focus between the toast's own controls is not "leaving".
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setIsFocusWithin(false)
      }
    }, [])

    const handleClose = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation()
        toast.onDismiss?.()
        onRemove(toast.id)
      },
      [onRemove, toast]
    )

    const handleAction = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation()
        try {
          toast.onAction?.()
        } finally {
          toast.onDismiss?.()
          onRemove(toast.id)
        }
      },
      [onRemove, toast]
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
          transition: { duration: DURATION.slow, ease: 'easeOut' }
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.7 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        // `pointer-events` is owned by the stack wrapper: it flips the whole
        // card off for background decks. Re-enabling it here made the visible
        // sliver above the front card hoverable again.
        inert={isBackgrounded ? true : undefined}
        aria-hidden={isBackgrounded ? true : undefined}
        className={cn(
          'group relative',
          'mb-2 w-full overflow-hidden rounded-xl',
          'flex items-start gap-0',
          // The card's own transform belongs to the entrance/exit motion above;
          // a utility `scale-*` here would never reach the compositor because
          // Motion owns the inline transform. Shadow is the hover cue instead.
          'motion-slow transition-[color,background-color,box-shadow] ease-out',
          isHovered && 'shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]',
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
            <h4 className="text-ql-13 text-foreground mb-0.5 leading-tight font-semibold">
              {toast.title
                ? toast.params
                  ? t(toast.title, toast.params)
                  : t(toast.title)
                : t(`toast.${toast.type}.title`)}
            </h4>
            {/* Errors are diagnostic: clamping them can hide the part the user
                needs. Other toast types keep the compact two-line preview. */}
            <p
              className={cn(
                'text-ql-12 text-muted-foreground leading-relaxed break-words',
                toast.type !== 'error' && 'line-clamp-2'
              )}
            >
              {renderToastMessage(toast.params ? t(toast.message, toast.params) : t(toast.message))}
            </p>
            {toast.actionLabel && (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={handleAction}
                className="text-ql-11 mt-1.5 px-0 underline underline-offset-2 hover:opacity-80"
              >
                {t(toast.actionLabel)}
              </Button>
            )}
          </div>

          <IconButton
            type="button"
            size="compact"
            variant="ghost"
            onClick={handleClose}
            className="motion-normal mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100 pointer-coarse:opacity-100"
            aria-label={t('close_notification')}
          >
            <X />
          </IconButton>
        </div>

        {!isPersistent && (
          <div className="absolute right-0 bottom-0 left-0 h-[2px] bg-white/10">
            <div
              key={animationKey}
              data-testid="toast-progress"
              className={cn('h-full', PROGRESS_COLORS[toast.type] || PROGRESS_COLORS.info)}
              style={{
                width: '100%',
                transformOrigin: 'left',
                // The duration is the toast's *total* lifetime, not what is
                // left: the animation element stays mounted through a pause and
                // resumes from its own frozen offset. Feeding it the remaining
                // time shortened the timeline mid-animation, so the bar jumped
                // forward and then finished early on every hover. The key only
                // changes when the duration itself changes, which restarts both
                // the bar and the timeout together.
                animation: `toast-progress-shrink ${configuredDuration}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running'
              }}
            />
          </div>
        )}
      </motion.div>
    )
  })
)

export default ToastItem
ToastItem.displayName = 'ToastItem'
