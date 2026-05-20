import { useEffect, useMemo, memo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguageStrings } from '@app/providers'
import { useTargetRects, useTourNavigation } from './useTourNavigation'

const STEP_CONFIG = [
  {
    targetId: 'bottom-bar-hub-btn',
    titleKey: 'ua_step1_title',
    textKey: 'ua_step1_text'
  },
  {
    targetIds: ['bottom-bar-tools-panel', 'bottom-bar-models-list'],
    titleKey: 'ua_step2_title',
    textKey: 'ua_step2_text'
  },
  {
    targetId: 'tool-btn-picker',
    titleKey: 'ua_step3_title',
    textKey: 'ua_step3_text'
  },
  {
    targetId: 'tool-btn-swap',
    titleKey: 'ua_step4_title',
    textKey: 'ua_step4_text'
  },
  {
    targetId: 'tool-btn-settings',
    titleKey: 'ua_step5_title',
    textKey: 'ua_step5_text'
  }
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
  id?: string
  targetId?: string
  index?: number
}

interface PointerProps {
  rect: Rect
  color?: string
}

interface HighlightBoxProps {
  rect: Rect
  color?: string
}

interface TooltipProps {
  step: number
  totalSteps: number
  title: string
  text: string
  onNext: () => void
  onSkip: () => void
  finishText: string
  nextText: string
  skipText: string
}

interface UsageAssistantProps {
  isActive: boolean
  onClose: () => void
}

const Pointer = memo<PointerProps>(({ rect, color = '#10b981' }) => {
  if (!rect) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed z-[10001] pointer-events-none"
      style={{
        left: rect.left + rect.width / 2 - 24,
        top: rect.top - 80
      }}
    >
      <div className="relative">
        <div
          className="absolute inset-x-0 bottom-0 h-10 blur-xl opacity-40 rounded-full"
          style={{ backgroundColor: color }}
        />

        <motion.svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          animate={{ y: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          className="relative"
        >
          <defs>
            <linearGradient id="pointerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <path
            d="M12 4L12 20M12 20L6 14M12 20L18 14"
            stroke="url(#pointerGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 20L6 14M12 20L18 14"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-50"
            style={{ filter: 'blur(2px)' }}
          />
        </motion.svg>
      </div>
    </motion.div>
  )
})

const HighlightBox = memo<HighlightBoxProps>(({ rect, color = '#3b82f6' }) => {
  if (!rect) return null

  return (
    <div
      className="fixed z-[10000] pointer-events-none"
      style={{
        left: rect.left - 12,
        top: rect.top - 12,
        width: rect.width + 24,
        height: rect.height + 24
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute inset-0 rounded-2xl"
        style={{
          border: `2px solid ${color}`,
          boxShadow: `0 0 0 2px ${color}20`
        }}
      />

      <motion.div
        animate={{
          opacity: [0.1, 0.3, 0.1],
          scale: [1, 1.05, 1]
        }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-2xl"
        style={{
          backgroundColor: `${color}10`,
          boxShadow: `0 0 30px 5px ${color}30`
        }}
      />

      {[
        'top-0 left-0 border-t-4 border-l-4',
        'top-0 right-0 border-t-4 border-r-4',
        'bottom-0 left-0 border-b-4 border-l-4',
        'bottom-0 right-0 border-b-4 border-r-4'
      ].map((cls, i) => (
        <div
          key={i}
          className={`absolute w-4 h-4 rounded-sm ${cls}`}
          style={{ borderColor: color }}
        />
      ))}
    </div>
  )
})

const Tooltip = memo<TooltipProps>(
  ({ step, totalSteps, title, text, onNext, onSkip, finishText, nextText, skipText }) => {
    return (
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed z-[10002] left-1/2 bottom-[10%] -translate-x-1/2 w-[440px] p-8 rounded-[2rem] bg-slate-900/90 backdrop-blur-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[2rem] pointer-events-none" />

        <div className="relative flex items-center gap-5 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-ql-20 font-black shadow-lg shadow-amber-500/20">
            {step + 1}
          </div>
          <div className="flex-1">
            <h3 className="text-ql-20 font-black text-white tracking-tight">{title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-width duration-300 ${
                    i === step ? 'bg-amber-400 w-6' : 'bg-white/10 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative mb-8">
          <p className="text-ql-16 text-white/70 leading-relaxed font-medium">{text}</p>
        </div>

        <div className="relative flex items-center justify-between pt-6 border-t border-white/5">
          <button
            onClick={onSkip}
            className="px-5 py-2.5 text-ql-14 font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-ql-caps"
          >
            {skipText}
          </button>

          <button
            onClick={onNext}
            className="group px-7 py-3 rounded-2xl bg-white text-slate-900 text-ql-14 font-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-xl shadow-white/10"
          >
            {step === totalSteps - 1 ? finishText : nextText}
            <motion.svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ x: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </motion.svg>
          </button>
        </div>
      </motion.div>
    )
  }
)

function UsageAssistant({ isActive, onClose }: UsageAssistantProps) {
  const { t } = useLanguageStrings()
  const { step, handleNext, handleSkip, resetStep } = useTourNavigation({
    totalSteps: STEP_CONFIG.length,
    onClose
  })

  const stepConfig = STEP_CONFIG[step]
  const rects = useTargetRects({ isActive, stepConfig })

  const colors = useMemo(() => ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'], [])

  useEffect(() => {
    if (isActive) {
      resetStep()
    }
  }, [isActive, resetStep])

  if (!isActive) return null

  const title = t(stepConfig?.titleKey) || `Step ${step + 1}`
  const text = t(stepConfig?.textKey) || ''

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        <div style={{ pointerEvents: 'auto' }}>
          <Tooltip
            step={step}
            totalSteps={STEP_CONFIG.length}
            title={title}
            text={text}
            onNext={handleNext}
            onSkip={handleSkip}
            finishText={t('ua_finish')}
            nextText={t('ua_next')}
            skipText={t('ua_skip')}
          />
        </div>

        {rects.map((rect, index) => (
          <Fragment key={`${step}-${rect.id}-${index}`}>
            <HighlightBox rect={rect} color={colors[index % colors.length]} />
            {step === 0 && <Pointer rect={rect} color={colors[0]} />}
          </Fragment>
        ))}
      </div>
    </AnimatePresence>
  )
}

export default UsageAssistant
