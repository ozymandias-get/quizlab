import { Input } from '@app/components/ui/input'
import { Logger } from '@shared/lib/logger'

import { Mic, Plus, Send } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ChangeEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTutorialStore } from '../store/tutorialStore'
import type { HoveredRect } from './TutorialSubComponents'
import {
  TutorialHeader,
  TutorialHoveredOverlay,
  TutorialStepIndicator,
  TutorialTooltipCard
} from './TutorialSubComponents'

interface MagicSelectorTutorialProps {
  onClose: () => void
  onComplete?: () => void
  tutorialId?: string
  isActive?: boolean
}

const STEPS = [
  { key: 'welcome', titleKey: 'tut_welcome_title', descKey: 'tut_welcome_desc' },
  { key: 'select_input', titleKey: 'tut_select_input_title', descKey: 'tut_select_input_desc' },
  { key: 'type_msg', titleKey: 'tut_type_msg_title', descKey: 'tut_type_msg_desc' },
  { key: 'select_btn', titleKey: 'tut_select_btn_title', descKey: 'tut_select_btn_desc' },
  { key: 'success', titleKey: 'tut_success_title', descKey: 'tut_success_desc' }
] as const

export default function MagicSelectorTutorial({
  onClose,
  onComplete,
  tutorialId
}: MagicSelectorTutorialProps) {
  const { t } = useTranslation()
  const finishTutorial = useTutorialStore((s) => s.finishTutorial)
  const markComplete = useTutorialStore((s) => s.markComplete)
  const [step, setStep] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [isButtonVisible, setIsButtonVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredRect, setHoveredRect] = useState<HoveredRect | null>(null)
  const isFinishingRef = useRef(false)

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [])

  useEffect(() => {
    Logger.info(
      `[Tutorial] step → ${step} (${STEPS[step]?.key ?? '?'}) active=`,
      (document.activeElement?.tagName ?? 'null').toLowerCase()
    )
  }, [step])

  useEffect(() => {
    if ((step !== 2 && step !== 3) || !inputRef.current) return
    const target = inputRef.current
    const raf = window.requestAnimationFrame(() => {
      if (inputRef.current === target) target.focus()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [step])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    if (step === 2 && val.length > 0) {
      setIsButtonVisible(true)
      setStep(3)
    }
  }

  const handleElementClick = (type: 'input' | 'button') => {
    if (isFinishingRef.current) return
    if (step === 1 && type === 'input') setStep(2)
    else if (step === 3 && type === 'button') setStep(4)
  }

  const handleElementHover = (e: MouseEvent<HTMLElement>, type: 'input' | 'button') => {
    if (step !== 1 && step !== 3) return
    if (!containerRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    setHoveredRect({
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
      type
    })
  }

  const handleMouseLeave = () => setHoveredRect(null)

  const handleFinishClick = () => {
    if (isFinishingRef.current) return
    isFinishingRef.current = true
    if (onComplete) {
      onComplete()
    } else {
      if (tutorialId) markComplete(tutorialId)
      finishTutorial()
    }
  }

  const goToStep = (next: number) => {
    if (isFinishingRef.current) return
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)))
  }

  const currentStep = STEPS[step] ?? STEPS[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="z-modal bg-background text-foreground absolute inset-0 flex flex-col overflow-hidden"
    >
      <TutorialHeader onClose={onClose} t={t} />

      <TutorialStepIndicator step={step} STEPS={STEPS} goToStep={goToStep} t={t} />

      <div ref={containerRef} className="relative flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className="border-border bg-card mb-4 flex h-12 w-12 items-center justify-center rounded-xl border shadow-xs">
            <div className="bg-primary h-6 w-6 rounded-lg" />
          </div>
          <h2 className="text-ql-18 text-foreground mb-2 max-w-lg text-center font-semibold">
            {t('tut_example_site_desc')}
          </h2>
        </div>

        <div className="relative mx-auto w-full max-w-3xl px-4 pb-8">
          <TutorialTooltipCard
            step={step}
            currentStep={currentStep}
            STEPS={STEPS}
            goToStep={goToStep}
            handleFinishClick={handleFinishClick}
            t={t}
          />

          <div className="border-border bg-card relative flex items-center gap-3 rounded-xl border p-2.5 shadow-xs">
            <div className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors">
              <Plus className="h-4 w-4" />
            </div>
            <Input
              ref={inputRef}
              id="tutorial-composer-input"
              name="message"
              value={inputValue}
              onChange={handleInputChange}
              disabled={step === 4}
              placeholder={t('tut_placeholder')}
              className={`text-ql-14 h-auto flex-1 border-none bg-transparent px-2 py-1 shadow-none focus-visible:ring-0 ${step === 1 ? 'cursor-pointer' : ''}`}
              onMouseEnter={(e) => {
                handleElementHover(e, 'input')
                if (step === 2 || step === 3) e.currentTarget.focus()
              }}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => {
                handleElementClick('input')
                e.currentTarget.focus()
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {step === 1 && (
              <div className="border-primary pointer-events-none absolute inset-0 z-20 animate-pulse rounded-xl border-2">
                <div className="text-ql-10 bg-primary text-primary-foreground absolute -top-3 left-10 rounded px-2 py-0.5 font-bold shadow-xs">
                  {t('tut_click_input')}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!isButtonVisible && step < 3 && (
                <div className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors">
                  <Mic className="h-4 w-4" />
                </div>
              )}
              <AnimatePresence>
                {(isButtonVisible || step === 3) && (
                  <motion.button
                    ref={buttonRef}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    data-testid="tutorial-send-button"
                    disabled={!isButtonVisible}
                    className={`text-primary-foreground relative flex items-center justify-center rounded-lg p-2 transition-colors ${isButtonVisible && step === 3 ? 'bg-primary hover:bg-primary/90 cursor-pointer shadow-xs' : 'bg-primary/30 cursor-not-allowed'}`}
                    onMouseEnter={(e) => handleElementHover(e, 'button')}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleElementClick('button')}
                  >
                    <Send className="h-4 w-4" />
                    {step === 3 && (
                      <div className="text-ql-10 bg-primary text-primary-foreground absolute -top-2 -right-2 rounded px-1.5 py-0.5 font-bold shadow-xs">
                        {t('tut_click_btn')}
                      </div>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="text-ql-12 text-muted-foreground mt-2 text-center">
            {t('tut_disclaimer')}
          </div>
        </div>

        <TutorialHoveredOverlay hoveredRect={hoveredRect} t={t} />
      </div>
    </motion.div>
  )
}
