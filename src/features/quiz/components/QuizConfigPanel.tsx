/**
 * QuizConfigPanel - Quiz Configuration Interface
 * Premium Glass Morphism Design
 */
import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Wand2, Brain, Microscope, AlertTriangle, ChevronDown, Upload, Loader2, FileText, Rabbit } from 'lucide-react'
import { Difficulty, QuizSettings, DifficultyType, QuestionStyleEnum, QuestionStyle, STYLE_ICONS, getModelConfigs } from '@src/features/quiz/api'

// Interfaces (QuizSettings is imported)

interface QuizConfigPanelProps {
    settings: QuizSettings;
    setSettings: React.Dispatch<React.SetStateAction<QuizSettings>>;
    onStartQuiz: (mode: boolean) => void; // accepts boolean for isDemo param
    pdfPath?: string;
    fileName?: string;
    onLoadPdf: () => void;
    isLoadingPdf?: boolean;
    t: (key: string) => string;
    isRegenerating?: boolean;
    onStartDemo?: () => void;
    isDemoMode?: boolean;
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
    onStartDemo, // New prop
    isDemoMode = false // New prop
}: QuizConfigPanelProps) {
    const [activeSection, setActiveSection] = useState<string | null>(null)

    // Memoize models to avoid re-calculation on every render
    const models = useMemo(() => getModelConfigs(t), [t])

    const toggleSection = (section: string) => {
        setActiveSection(activeSection === section ? null : section)
    }

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
                {/* PDF Status & Upload - Glass Card */}
                <motion.div
                    className={`quiz-glass-card p-5 ${hasPdf ? '' : 'quiz-pdf-card empty'}`}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3.5 rounded-2xl transition-all duration-300 ${hasPdf
                            ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10'
                            : isDemoMode
                                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-blue-400 shadow-lg shadow-blue-500/10'
                                : 'bg-gradient-to-br from-stone-500/20 to-stone-600/10 text-stone-400'}`}
                        >
                            {isLoadingPdf ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : hasPdf ? (
                                <FileText className="w-6 h-6" />
                            ) : isDemoMode ? (
                                <Rabbit className="w-6 h-6" />
                            ) : (
                                <Upload className="w-6 h-6" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold ${hasPdf ? 'text-emerald-400' : isDemoMode ? 'text-blue-400' : 'text-stone-400'}`}>
                                {isLoadingPdf ? t('quiz_pdf_loading') :
                                    hasPdf ? t('quiz_pdf_ready') :
                                        isDemoMode ? t('quiz_demo_active') :
                                            t('quiz_pdf_select')}
                            </p>
                            <p className="text-xs text-white/40 truncate mt-0.5">
                                {hasPdf
                                    ? `${fileName || t('quiz_pdf_file')} • Gemini AI`
                                    : isDemoMode
                                        ? t('quiz_demo_desc')
                                        : t('quiz_pdf_upload_desc')
                                }
                            </p>
                        </div>
                        <motion.button
                            onClick={onLoadPdf}
                            disabled={isLoadingPdf}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-300 ${hasPdf || isDemoMode
                                ? 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                                }`}
                        >
                            {isLoadingPdf ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            {hasPdf ? t('quiz_pdf_change') : t('quiz_pdf_select')}
                        </motion.button>
                    </div>
                </motion.div>

                {/* Regeneration Mode Banner */}
                <AnimatePresence>
                    {isRegenerating && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="quiz-glass-card p-4 flex items-start gap-3 border-l-4 border-indigo-500"
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
                <div className="quiz-glass-card p-5">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 block flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5" />
                        {t('quiz_ai_model')}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {models.map((m) => {
                            const IconComp = m.icon
                            const isSelected = settings.model === m.type
                            return (
                                <motion.button
                                    key={m.type}
                                    onClick={() => setSettings(s => ({ ...s, model: m.type }))}
                                    whileHover={{ scale: 1.03, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`quiz-model-btn ${isSelected ? 'selected' : ''}`}
                                >
                                    <div className={`p-2 rounded-lg transition-all ${isSelected
                                        ? `bg-gradient-to-br ${m.color} shadow-lg`
                                        : 'bg-white/10'}`}>
                                        <IconComp className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-white/50'}`} />
                                    </div>
                                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-white/60'}`}>{m.label}</span>
                                    <span className={`text-[10px] ${isSelected ? 'text-amber-400/80' : 'text-white/30'}`}>{m.desc}</span>
                                </motion.button>
                            )
                        })}
                    </div>
                </div>

                {/* Difficulty & Question Count */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Difficulty */}
                    <div className="quiz-glass-card p-5">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 block">
                            {t('quiz_difficulty')}
                        </label>
                        <div className="quiz-difficulty-track">
                            {(Object.values(Difficulty) as DifficultyType[]).map((diff) => (
                                <motion.button
                                    key={diff}
                                    onClick={() => setSettings(s => ({ ...s, difficulty: diff }))}
                                    whileTap={{ scale: 0.95 }}
                                    className={`quiz-difficulty-btn ${settings.difficulty === diff ? 'selected text-white' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    {t(`difficulty_${diff.toLowerCase()}`)}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Question Count */}
                    <div className="quiz-glass-card p-5">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                                {t('quiz_question_count')}
                            </label>
                            <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                                {settings.questionCount}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={settings.questionCount}
                            onChange={(e) => setSettings(s => ({ ...s, questionCount: parseInt(e.target.value) }))}
                            className="quiz-range-slider"
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-2 px-1">
                            <span>1</span>
                            <span>15</span>
                            <span>30</span>
                        </div>
                    </div>
                </div>

                {/* Question Styles */}
                <div className="quiz-glass-card p-5">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 block flex items-center gap-2">
                        <STYLE_ICONS.MIXED className="w-3.5 h-3.5" />
                        {t('quiz_style')}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {(Object.values(QuestionStyle) as QuestionStyleEnum[]).map((style) => {
                            const isSelected = settings.style.includes(style)
                            const IconComp = STYLE_ICONS[style] || STYLE_ICONS[QuestionStyle.CLASSIC]
                            const styleKey = `style_${style.toLowerCase()}`

                            return (
                                <motion.button
                                    key={style}
                                    onClick={() => {
                                        setSettings(s => {
                                            // If clicking MIXED, set only MIXED
                                            if (style === QuestionStyle.MIXED) {
                                                return { ...s, style: [QuestionStyle.MIXED] as QuestionStyleEnum[] }
                                            }

                                            // For other styles, remove MIXED first
                                            let newStyles: QuestionStyleEnum[] = s.style.filter(x => x !== QuestionStyle.MIXED)

                                            if (isSelected) {
                                                // Deselecting this style
                                                newStyles = newStyles.filter(x => x !== style)
                                                // If no styles left, fall back to MIXED
                                                if (newStyles.length === 0) {
                                                    newStyles = [QuestionStyle.MIXED] as QuestionStyleEnum[]
                                                }
                                            } else {
                                                // Selecting this style
                                                newStyles = [...newStyles, style]
                                            }
                                            return { ...s, style: newStyles }
                                        })
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`quiz-option-btn ${isSelected ? 'selected' : ''}`}
                                >
                                    <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-white/40'}`} />
                                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white/50'}`}>
                                        {t(styleKey)}
                                    </span>
                                </motion.button>
                            )
                        })}
                    </div>
                </div>

                {/* Advanced Options - Focus Topic */}
                <div className="quiz-glass-card overflow-hidden">
                    <motion.button
                        onClick={() => toggleSection('focus')}
                        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl transition-all duration-300 ${activeSection === 'focus'
                                ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-400'
                                : 'bg-white/10 text-white/50'
                                }`}>
                                <Microscope className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                                <span className="font-bold text-sm text-white/80 block">{t('quiz_focus')}</span>
                                <span className="text-xs text-white/40">{t('quiz_focus_desc')}</span>
                            </div>
                        </div>
                        <motion.div
                            animate={{ rotate: activeSection === 'focus' ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ChevronDown className="w-5 h-5 text-white/40" />
                        </motion.div>
                    </motion.button>

                    <AnimatePresence>
                        {activeSection === 'focus' && (
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
                                        onChange={(e) => setSettings(s => ({ ...s, focusTopic: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-500/40 focus:bg-white/10 transition-all"
                                    />
                                    <p className="text-xs text-white/40 mt-3 px-1">
                                        {t('quiz_focus_hint')}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Action Buttons */}
                <motion.button
                    onClick={() => onStartQuiz(!!isDemoMode)} // Pass current mode state
                    disabled={!canStart}
                    whileHover={canStart ? { scale: 1.02, y: -2 } : {}}
                    whileTap={canStart ? { scale: 0.98 } : {}}
                    className={`quiz-primary-btn w-full md:w-auto ${!canStart ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {t('quiz_create')}
                    <Play className="w-5 h-5" fill="currentColor" />
                </motion.button>
            </div>

            {/* Disclaimer */}
            <div className="flex items-center justify-center gap-2 text-xs text-amber-500/60 font-medium uppercase tracking-wider pt-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t('quiz_disclaimer')}</span>
            </div>
            {/* Demo Button (Developer Mode) */}
            {onStartDemo && (
                <div className="flex justify-center pt-2">
                    <button
                        onClick={onStartDemo}
                        className="text-xs font-bold text-white/20 hover:text-white/50 uppercase tracking-widest transition-colors"
                    >
                        • {t('quiz_demo_start')} •
                    </button>
                </div>
            )}
        </motion.div>
    )
}

export default QuizConfigPanel

