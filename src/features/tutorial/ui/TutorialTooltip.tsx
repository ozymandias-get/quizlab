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
      initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
      className="fixed z-[10002] w-[440px] max-w-[calc(100vw-2rem)] rounded-[2rem] border border-white/10 bg-slate-900/90 p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl outline-none"
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/5 to-transparent" />

      <div className="relative mb-6 flex items-center gap-5">
        <div className="text-ql-20 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 font-black text-white shadow-lg shadow-amber-500/20">
          {step + 1}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-ql-20 font-black tracking-tight text-white">{title}</h3>
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
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-amber-400' : 'w-2 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-8" id="tutorial-tooltip-body">
        <p className="text-ql-16 leading-relaxed font-medium text-white/70">{body}</p>
      </div>

      <div className="relative flex items-center justify-between border-t border-white/5 pt-6">
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onBack}
              className="text-ql-14 flex items-center gap-1.5 px-4 py-2.5 font-bold text-white/40 transition-colors hover:text-white/70"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="text-ql-14 tracking-ql-caps px-5 py-2.5 font-bold text-white/30 uppercase transition-colors hover:text-white/60"
          >
            {skipLabel}
          </button>
          <button
            onClick={isLastStep ? onFinish : onNext}
            className="group text-ql-14 flex items-center gap-2 rounded-2xl bg-white px-7 py-3 font-black text-slate-900 shadow-xl shadow-white/10 transition-colors hover:scale-105 active:scale-95"
            aria-label={isLastStep ? finishLabel : nextLabel}
          >
            {isLastStep ? finishLabel : nextLabel}
            {!isLastStep && (
              <motion.svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={prefersReducedMotion ? undefined : { x: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M9 5l7 7-7 7"
                />
              </motion.svg>
            )}
            {isLastStep && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
})

export default TutorialTooltip
