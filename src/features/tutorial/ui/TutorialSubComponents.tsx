import { MagicWandIcon } from '@ui/components/Icons'

import { Check, ChevronDown, Lightbulb, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

export interface HoveredRect {
  top: number
  left: number
  width: number
  height: number
  type: 'input' | 'button'
}

interface TutorialHeaderProps {
  onClose: () => void
  t: (key: string) => string
}

export function TutorialHeader({ onClose, t }: TutorialHeaderProps) {
  return (
    <div className="z-10 flex h-14 items-center justify-between border-b border-white/5 bg-black/30 px-5 backdrop-blur-md">
      <div className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-gray-200 transition-colors hover:bg-white/5">
        <span>ChatGPT 5.2</span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </div>
      <div className="flex items-center gap-3">
        <div className="text-ql-11 hidden items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 font-semibold tracking-wide text-purple-300 uppercase sm:flex">
          <Sparkles className="h-3 w-3" /> Magic Selector
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          title={t('tut_close')}
          aria-label={t('tut_close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface TutorialStepIndicatorProps {
  step: number
  STEPS: readonly { readonly key: string; readonly titleKey: string; readonly descKey: string }[]
  goToStep: (n: number) => void
  t: (key: string) => string
}

export function TutorialStepIndicator({ step, STEPS, goToStep, t }: TutorialStepIndicatorProps) {
  return (
    <div className="z-10 flex items-center gap-2 px-5 py-3">
      {STEPS.map((s, i) => {
        const isActive = i === step,
          isDone = i < step
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => goToStep(i)}
            className="group flex min-w-0 items-center gap-2"
            aria-label={`Step ${i + 1}: ${t(s.titleKey)}`}
          >
            <span
              className={`text-ql-11 flex h-6 w-6 items-center justify-center rounded-full font-semibold transition-all ${isDone ? 'bg-emerald-500/90 text-black' : isActive ? 'bg-purple-500 text-white shadow-[0_0_0_4px_rgba(168,85,247,0.18)]' : 'border border-white/10 bg-white/5 text-gray-500'}`}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={`text-ql-12 truncate font-medium transition-colors ${isActive ? 'text-white' : isDone ? 'text-emerald-300/80' : 'text-gray-500'}`}
            >
              {t(s.titleKey)}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px w-6 transition-colors sm:w-10 ${isDone ? 'bg-emerald-500/60' : 'bg-white/10'}`}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

interface TutorialTooltipCardProps {
  step: number
  currentStep: { key: string; titleKey: string; descKey: string }
  STEPS: readonly { readonly key: string; readonly titleKey: string; readonly descKey: string }[]
  goToStep: (n: number) => void
  handleFinishClick: () => void
  t: (key: string) => string
}

export function TutorialTooltipCard({
  step,
  currentStep,
  STEPS,
  goToStep,
  handleFinishClick,
  t
}: TutorialTooltipCardProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep.key}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -12, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="pointer-events-none absolute -top-32 right-0 left-0 z-30 mx-auto w-max max-w-xl"
      >
        <div className="pointer-events-auto flex items-start gap-4 rounded-2xl border border-white/10 bg-[#1f1f24] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="mt-0.5 rounded-xl bg-purple-500/15 p-2 text-purple-300">
            <MagicWandIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="text-ql-14 font-semibold text-white">{t(currentStep.titleKey)}</h4>
              <span className="text-ql-10 font-semibold tracking-wider text-gray-500 uppercase">
                {step + 1}/{STEPS.length}
              </span>
            </div>
            <p className="text-ql-13 max-w-sm leading-relaxed text-gray-300/90">
              {t(currentStep.descKey)}
            </p>
            {step === 0 && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => goToStep(1)}
                  className="text-ql-12 rounded-lg bg-purple-600 px-4 py-1.5 font-semibold text-white shadow-[0_4px_14px_rgba(168,85,247,0.35)] transition-colors hover:bg-purple-500"
                >
                  {t('tut_start')}
                </button>
                <span className="text-ql-11 inline-flex items-center gap-1 text-gray-500">
                  <Lightbulb className="h-3 w-3" /> {t('tut_disclaimer')}
                </span>
              </div>
            )}
            {step === 4 && (
              <button
                onClick={handleFinishClick}
                className="text-ql-12 mt-3 rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-colors hover:bg-emerald-500"
              >
                {t('tut_finish')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface TutorialHoveredOverlayProps {
  hoveredRect: HoveredRect | null
  t: (key: string) => string
}

export function TutorialHoveredOverlay({ hoveredRect, t }: TutorialHoveredOverlayProps) {
  if (!hoveredRect) return null

  return (
    <motion.div
      layoutId="selector-highlight"
      className="z-tooltip pointer-events-none absolute rounded-lg border-2 border-emerald-400 bg-emerald-400/10 mix-blend-screen shadow-[0_0_24px_rgba(52,211,153,0.25)]"
      style={{
        top: hoveredRect.top,
        left: hoveredRect.left,
        width: hoveredRect.width,
        height: hoveredRect.height
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-ql-10 absolute -top-6 left-0 rounded bg-emerald-500 px-2 py-0.5 font-bold tracking-wider text-black uppercase">
        {hoveredRect.type === 'input' ? t('tut_input_label') : t('tut_btn_label')}
      </div>
    </motion.div>
  )
}
