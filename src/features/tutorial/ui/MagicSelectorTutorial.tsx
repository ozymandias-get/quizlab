import { Input } from '@app/components/ui/input'
import { Logger } from '@shared/lib/logger'
import { MagicWandIcon } from '@ui/components/Icons'

import { Check, ChevronDown, Lightbulb, Mic, Plus, Send, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ChangeEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTutorialStore } from '../store/tutorialStore'

interface MagicSelectorTutorialProps {
  onClose: () => void
  onComplete?: () => void
  tutorialId?: string
  isActive?: boolean
}

interface HoveredRect {
  top: number
  left: number
  width: number
  height: number
  type: 'input' | 'button'
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
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="z-modal absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#1a1a1f] via-[#161619] to-[#121215] text-white"
    >
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

      <div ref={containerRef} className="relative flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_30px_rgba(255,255,255,0.08)]">
            <div className="h-9 w-9 rounded-full bg-black" />
          </div>
          <h2 className="text-ql-20 mb-2 max-w-lg text-center font-semibold text-white">
            {t('tut_example_site_desc')}
          </h2>
        </div>

        <div className="relative mx-auto w-full max-w-3xl px-4 pb-8">
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
                    <h4 className="text-ql-14 font-semibold text-white">
                      {t(currentStep.titleKey)}
                    </h4>
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

          <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1f1f24] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <div className="cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5">
              <Plus className="h-5 w-5" />
            </div>
            <Input
              ref={inputRef}
              id="tutorial-composer-input"
              name="message"
              value={inputValue}
              onChange={handleInputChange}
              disabled={step === 4}
              placeholder={t('tut_placeholder')}
              className={`text-ql-16 h-auto flex-1 border-none bg-transparent px-2 py-1 shadow-none focus:bg-white/[0.04] focus:ring-2 focus:ring-purple-500/40 ${step === 1 ? 'cursor-pointer' : ''}`}
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
              <div className="pointer-events-none absolute inset-0 z-20 animate-pulse rounded-2xl border-2 border-purple-500">
                <div className="text-ql-10 absolute -top-3 left-10 rounded bg-purple-500 px-2 py-0.5 font-bold text-white shadow-[0_4px_12px_rgba(168,85,247,0.4)]">
                  {t('tut_click_input')}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!isButtonVisible && step < 3 && (
                <div className="cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5">
                  <Mic className="h-5 w-5" />
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
                    className={`relative flex items-center justify-center rounded-lg p-2 text-white transition-colors ${isButtonVisible && step === 3 ? 'cursor-pointer bg-purple-600 shadow-[0_4px_14px_rgba(168,85,247,0.35)] hover:bg-purple-500' : 'cursor-not-allowed bg-purple-600/30'}`}
                    onMouseEnter={(e) => handleElementHover(e, 'button')}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleElementClick('button')}
                  >
                    <Send className="h-4 w-4" />
                    {step === 3 && (
                      <div className="text-ql-10 absolute -top-2 -right-2 rounded bg-purple-500 px-1.5 py-0.5 font-bold text-white shadow-[0_4px_12px_rgba(168,85,247,0.4)]">
                        {t('tut_click_btn')}
                      </div>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="text-ql-12 mt-2 text-center text-gray-500">{t('tut_disclaimer')}</div>
        </div>

        {hoveredRect && (
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
        )}
      </div>
    </motion.div>
  )
}
