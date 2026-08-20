import { Button } from '@app/components/ui/button'
import { DURATION } from '@shared/lib/motion'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useRef } from 'react'

interface TutorialTooltipProps {
  step: number
  totalSteps: number
  title: string
  body: string
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
  isFirstStep: boolean
  isLastStep: boolean
  nextLabel: string
  backLabel: string
  skipLabel: string
  finishLabel: string
  style?: React.CSSProperties
}

const TutorialTooltip = memo(function TutorialTooltip({
  step,
  totalSteps,
  title,
  body,
  onNext,
  onBack,
  onSkip,
  onFinish,
  isFirstStep,
  isLastStep,
  nextLabel,
  backLabel,
  skipLabel,
  finishLabel,
  style
}: TutorialTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion() ?? false

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (isLastStep) {
          onFinish()
        } else {
          onNext()
        }
      } else if (e.key === 'Backspace' && !isFirstStep) {
        e.preventDefault()
        onBack()
      }
    },
    [isLastStep, isFirstStep, onNext, onBack, onFinish]
  )

  useEffect(() => {
    const el = tooltipRef.current
    if (!el) return
    el.focus()
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <motion.div
      ref={tooltipRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-describedby="tutorial-tooltip-body"
      initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : DURATION.slow, ease: 'easeOut' }}
      className="border-border bg-popover text-popover-foreground shadow-ambient-xl z-tooltip fixed w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border p-6 backdrop-blur-md outline-none"
      style={style}
    >
      <div className="relative mb-4 flex items-center gap-4">
        <div className="text-ql-15 bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs">
          {step + 1}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-ql-15 text-foreground font-bold">{title}</h3>
          <div
            className="mt-1 flex items-center gap-1.5"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          >
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key -- Static step dots, stable order
                key={i}
                className={`motion-slow h-1 rounded-full transition-all ${
                  i === step ? 'bg-primary w-5' : 'bg-muted w-1.5'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-6" id="tutorial-tooltip-body">
        <p className="text-ql-13 text-muted-foreground leading-relaxed">{body}</p>
      </div>

      <div className="border-border relative flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <Button variant="ghost" size="sm" onClick={onBack} aria-label={backLabel}>
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {skipLabel}
          </Button>
          <Button
            size="sm"
            onClick={isLastStep ? onFinish : onNext}
            className="group"
            aria-label={isLastStep ? finishLabel : nextLabel}
          >
            {isLastStep ? finishLabel : nextLabel}
            {!isLastStep && (
              <motion.svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={prefersReducedMotion ? undefined : { x: [0, 2, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </motion.svg>
            )}
            {isLastStep && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </motion.div>
  )
})

export default TutorialTooltip
