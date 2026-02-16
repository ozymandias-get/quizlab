/**
 * QuizModule - Main Quiz Component
 * Orchestrates the quiz experience within Quizlab Reader
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Zap } from 'lucide-react'
import { useLanguage } from '@src/app/providers/LanguageContext'

import { useQuizFlow } from '../hooks/useQuizFlow'
import QuizConfigPanel from './QuizConfigPanel'
import QuizGenerating from './QuizGenerating'
import QuizActive from './QuizActive'
import QuizResults from './QuizResults'
import { QuizStep } from '../types'

interface QuizModuleProps {
    onClose: () => void;
    initialPdfPath?: string;
    initialPdfName?: string;
}

/**
 * QuizModule Component
 */
function QuizModule({ onClose, initialPdfPath = '', initialPdfName = '' }: QuizModuleProps) {
    const { t } = useLanguage()

    // Use custom hook for quiz logic
    const {
        step,
        settings,
        setSettings,
        quizState,
        setQuizState,
        error,
        loadingMessage,
        pdfPath,
        pdfFileName,
        isLoadingPdf,
        isDemoMode,
        handleLoadPdf,
        handleStartQuiz,
        handleStartDemo,
        handleStartActiveQuiz,
        handleFinishQuiz,
        handleRestart,
        handleRegenerate,
        handleRetryMistakes
    } = useQuizFlow({
        initialPdfPath,
        initialPdfName
    })

    const [slideDirection, setSlideDirection] = useState(0)

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full flex flex-col glass-panel overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, rgba(12, 10, 9, 0.98) 0%, rgba(28, 25, 23, 0.99) 50%, rgba(12, 10, 9, 0.98) 100%)'
            }}
        >
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
                        <Brain className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white/90">{t('quiz_title')}</h2>
                        <p className="text-xs text-white/40">{pdfFileName || t('quiz_subtitle')}</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all group"
                >
                    <X className="w-5 h-5 text-white/40 group-hover:text-red-400 transition-colors" />
                </button>
            </header>

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-red-500/10 border-b border-red-500/20 px-6 py-3"
                    >
                        <p className="text-sm text-red-400">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* Config Step */}
                    {step === QuizStep.CONFIG && (
                        <QuizConfigPanel
                            key="config"
                            settings={settings}
                            setSettings={setSettings}
                            onStartQuiz={handleStartQuiz}
                            pdfPath={pdfPath}
                            fileName={pdfFileName}
                            onLoadPdf={handleLoadPdf}
                            isLoadingPdf={isLoadingPdf}
                            t={t}
                            isRegenerating={false} // Hook manages regeneration separately via step reset
                            onStartDemo={handleStartDemo}
                            isDemoMode={isDemoMode}
                        />
                    )}

                    {/* Generating Step */}
                    {step === QuizStep.GENERATING && (
                        <QuizGenerating
                            key="generating"
                            message={loadingMessage}
                            t={t}
                        />
                    )}

                    {/* Ready Step */}
                    {step === QuizStep.READY && (
                        <motion.div
                            key="ready"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center h-full p-8"
                        >
                            <div className="text-center max-w-md">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Zap className="w-10 h-10 text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">{t('quiz_ready')}</h2>
                                <p className="text-white/50 mb-8">
                                    {quizState.questions.length} {t('quiz_ready_count')}
                                </p>
                                <button
                                    onClick={handleStartActiveQuiz}
                                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-105 transition-all"
                                >
                                    {t('quiz_start')}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Quiz Active Step */}
                    {step === QuizStep.QUIZ && (
                        <QuizActive
                            key="quiz"
                            quizState={quizState}
                            setQuizState={setQuizState}
                            slideDirection={slideDirection}
                            setSlideDirection={setSlideDirection}
                            onFinish={handleFinishQuiz}
                            t={t}
                        />
                    )}

                    {/* Results Step */}
                    {step === QuizStep.RESULTS && (
                        <QuizResults
                            key="results"
                            quizState={quizState}
                            settings={settings}
                            onRestart={handleRestart}
                            onRegenerate={handleRegenerate}
                            onRetryMistakes={handleRetryMistakes}
                            t={t}
                        />
                    )}

                </AnimatePresence>
            </main>
        </motion.div>
    )
}

export default QuizModule

