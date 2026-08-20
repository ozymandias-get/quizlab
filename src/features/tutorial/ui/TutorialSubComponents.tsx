import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { DURATION } from '@shared/lib/motion'
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
    <div className="border-border bg-card/90 z-10 flex h-12 items-center justify-between border-b px-4 backdrop-blur-md">
      <div className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1 text-sm font-medium transition-colors">
        <span>ChatGPT 5.2</span>
        <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="text-ql-11 border-primary/20 bg-primary/10 text-primary hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium uppercase sm:flex">
          <Sparkles className="h-3 w-3" /> Magic Selector
        </div>
        <WithTooltip label={t('tut_close')}>
          <IconButton size="compact" variant="ghost" onClick={onClose} aria-label={t('tut_close')}>
            <X />
          </IconButton>
        </WithTooltip>
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
    <div className="z-10 flex items-center gap-2 px-5 py-2.5">
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
              className={`text-ql-11 flex h-5 w-5 items-center justify-center rounded-full font-semibold transition-all ${
                isDone
                  ? 'bg-primary/20 text-primary font-bold'
                  : isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'border-border bg-muted text-muted-foreground border'
              }`}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={`text-ql-12 truncate font-medium transition-colors ${
                isActive
                  ? 'text-foreground font-semibold'
                  : isDone
                    ? 'text-primary'
                    : 'text-muted-foreground'
              }`}
            >
              {t(s.titleKey)}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px w-6 transition-colors sm:w-8 ${isDone ? 'bg-primary/50' : 'bg-border'}`}
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
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -8, opacity: 0 }}
        transition={{ duration: DURATION.slow, ease: 'easeOut' }}
        className="pointer-events-none absolute -top-28 right-0 left-0 z-30 mx-auto w-max max-w-xl"
      >
        <div className="border-border bg-popover text-popover-foreground shadow-ambient-lg pointer-events-auto flex items-start gap-3.5 rounded-xl border p-4 backdrop-blur-md">
          <div className="border-primary/20 bg-primary/10 text-primary mt-0.5 rounded-lg border p-2">
            <MagicWandIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="text-ql-13 text-foreground font-semibold">
                {t(currentStep.titleKey)}
              </h4>
              <span className="text-ql-10 text-muted-foreground font-medium uppercase">
                {step + 1}/{STEPS.length}
              </span>
            </div>
            <p className="text-ql-13 text-muted-foreground max-w-sm leading-relaxed">
              {t(currentStep.descKey)}
            </p>
            {step === 0 && (
              <div className="mt-2.5 flex items-center gap-2">
                <Button size="sm" onClick={() => goToStep(1)} className="text-ql-12 shadow-xs">
                  {t('tut_start')}
                </Button>
                <span className="text-ql-11 text-muted-foreground inline-flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> {t('tut_disclaimer')}
                </span>
              </div>
            )}
            {step === 4 && (
              <Button size="sm" onClick={handleFinishClick} className="text-ql-12 mt-2.5 shadow-xs">
                {t('tut_finish')}
              </Button>
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
      className="z-tooltip border-primary bg-primary/10 pointer-events-none absolute rounded-lg border-2 shadow-xs"
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
      <div className="text-ql-10 bg-primary text-primary-foreground absolute -top-5 left-0 rounded px-1.5 py-0.5 font-bold tracking-wider uppercase">
        {hoveredRect.type === 'input' ? t('tut_input_label') : t('tut_btn_label')}
      </div>
    </motion.div>
  )
}
