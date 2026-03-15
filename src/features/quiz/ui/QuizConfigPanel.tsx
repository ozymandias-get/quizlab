/**
 * QuizConfigPanel - Quiz Configuration Interface
 * Premium Glass Morphism Design
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Wand2, Microscope, AlertTriangle, ChevronDown } from 'lucide-react'
import { QuizSettings } from '@features/quiz/api'
import { cn } from '@shared/lib/uiUtils'
import { Button, buttonBaseClass } from '@ui/components/button'

// Sub-components
import { AIModelSelector } from './config/AIModelSelector'
import { DifficultySelector } from './config/DifficultySelector'
import { QuestionCountSlider } from './config/QuestionCountSlider'
import { StyleSelector } from './config/StyleSelector'
import { PdfStatusCard } from './config/PdfStatusCard'

interface QuizConfigPanelProps {
  settings: QuizSettings
  setSettings: React.Dispatch<React.SetStateAction<QuizSettings>>
  onStartQuiz: (mode: boolean) => void // accepts boolean for isDemo param
  pdfPath?: string
  fileName?: string
  onLoadPdf: () => void
  isLoadingPdf?: boolean
  t: (key: string) => string
  isRegenerating?: boolean
  onStartDemo?: () => void
  isDemoMode?: boolean
}

function QuizConfigPanel({
  settings,
  setSettings,
  onStartQuiz,
  pdfPath,
  fileName,
  onLoadPdf,
  isLoadingPdf = false,
  t,
  isRegenerating = false,
  onStartDemo,
  isDemoMode = false
}: QuizConfigPanelProps) {
  const [isFocusOpen, setIsFocusOpen] = useState(false)

  const hasPdf = !!(pdfPath && pdfPath.length > 0)
  const canStart = hasPdf || isDemoMode

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="quiz-config-container"
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {/* PDF Status & Upload */}
        <PdfStatusCard
          hasPdf={hasPdf}
          isDemoMode={isDemoMode}
          isLoadingPdf={isLoadingPdf}
          fileName={fileName}
          onLoadPdf={onLoadPdf}
          t={t}
        />

        {/* Regeneration Mode Banner */}
        <AnimatePresence>
          {isRegenerating && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="quiz-glass-card glass-surface glass-surface--card p-4 flex items-start gap-3 border-l-4 border-indigo-500"
            >
              <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 shrink-0">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-indigo-300 mb-1">{t('quiz_regen_mode')}</h4>
                <p className="text-xs text-indigo-400/70">{t('quiz_regen_desc')}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Model Selection */}
        <AIModelSelector settings={settings} setSettings={setSettings} t={t} />

        {/* Difficulty & Question Count */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DifficultySelector settings={settings} setSettings={setSettings} t={t} />

          <QuestionCountSlider settings={settings} setSettings={setSettings} t={t} />
        </div>

        {/* Style Selection */}
        <StyleSelector settings={settings} setSettings={setSettings} t={t} />

        {/* Focus Topic Section */}
        <div className="quiz-glass-card glass-surface glass-surface--card overflow-hidden">
          <motion.button
            type="button"
            onClick={() => setIsFocusOpen((open) => !open)}
            className={cn(
              buttonBaseClass,
              'w-full justify-between p-5 hover:bg-white/5 transition-colors whitespace-normal'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  isFocusOpen
                    ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-400'
                    : 'bg-white/10 text-white/50'
                }`}
              >
                <Microscope className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="font-bold text-sm text-white/80 block">{t('quiz_focus')}</span>
                <span className="text-xs text-white/40">{t('quiz_focus_desc')}</span>
              </div>
            </div>
            <motion.div animate={{ rotate: isFocusOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronDown className="w-5 h-5 text-white/40" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {isFocusOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-5 pt-0 border-t border-white/5">
                  <input
                    type="text"
                    placeholder={t('quiz_focus_placeholder')}
                    value={settings.focusTopic || ''}
                    onChange={(e) => setSettings((s) => ({ ...s, focusTopic: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-500/40 focus:bg-white/10 transition-all"
                  />
                  <p className="text-xs text-white/40 mt-3 px-1">{t('quiz_focus_hint')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          onClick={() => onStartQuiz(!!isDemoMode)}
          disabled={!canStart}
          whileHover={canStart ? { scale: 1.02, y: -2 } : {}}
          whileTap={canStart ? { scale: 0.98 } : {}}
          className={cn(
            buttonBaseClass,
            `quiz-primary-btn w-full md:w-auto ${!canStart ? 'opacity-50 cursor-not-allowed' : ''}`
          )}
        >
          {t('quiz_create')}
          <Play className="w-5 h-5" fill="currentColor" />
        </motion.button>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-amber-500/60 font-medium uppercase tracking-wider pt-2">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{t('quiz_disclaimer')}</span>
      </div>
      {onStartDemo && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onStartDemo}
            className="text-xs font-bold text-white/20 hover:text-white/50 uppercase tracking-widest transition-colors bg-transparent hover:bg-transparent px-0 py-0 h-auto"
          >
            • {t('quiz_demo_start')} •
          </Button>
        </div>
      )}
    </motion.div>
  )
}

export default QuizConfigPanel
