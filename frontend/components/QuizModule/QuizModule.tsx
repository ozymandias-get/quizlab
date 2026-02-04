/**
 * QuizModule - Main Quiz Component
 * Orchestrates the quiz experience within Quizlab Reader
 */
import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Zap } from 'lucide-react'
import { useLanguage } from '../../context'

// Quiz API
import {
    generateQuizQuestions,
    DEFAULT_SETTINGS,
    QuizSettings,
    Question,
    getQuizSettings,
    saveQuizSettings
} from '../../api/quizApi'

// Sub-components (will be created)
import QuizConfigPanel from './QuizConfigPanel'
import QuizGenerating from './QuizGenerating'
import QuizActive from './QuizActive'
import QuizResults from './QuizResults'

// Local Types (QuizState is specific to Module state, not API)
// QuizSettings is imported

interface QuizState {
    questions: Question[];
    userAnswers: Record<string, number>;
    currentQuestionIndex: number;
    score: number;
    isFinished: boolean;
    startTime: number | null;
    endTime: number | null;
}

// Quiz States
const QuizStep = {
    CONFIG: 'CONFIG',
    GENERATING: 'GENERATING',
    READY: 'READY',
    QUIZ: 'QUIZ',
    RESULTS: 'RESULTS'
} as const;

type QuizStepType = typeof QuizStep[keyof typeof QuizStep];

// Initial Quiz State
const INITIAL_QUIZ_STATE: QuizState = {
    questions: [],
    userAnswers: {},
    currentQuestionIndex: 0,
    score: 0,
    isFinished: false,
    startTime: null,
    endTime: null
}

interface QuizModuleProps {
    onClose: () => void;
    initialPdfPath?: string;
    initialPdfName?: string;
}

/**
 * QuizModule Component
 */
function QuizModule({ onClose, initialPdfPath = '', initialPdfName = '' }: QuizModuleProps) {
    const { t, language } = useLanguage()
    // Quiz State Management
    const [step, setStep] = useState<QuizStepType>(QuizStep.CONFIG)
    const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS)
    const [quizState, setQuizState] = useState<QuizState>(INITIAL_QUIZ_STATE)
    const [error, setError] = useState<string | null>(null)
    const [loadingMessage, setLoadingMessage] = useState('')
    const [usedQuestions, setUsedQuestions] = useState<Question[]>([])
    const [slideDirection, setSlideDirection] = useState(0)

    // PDF State - managed internally (now using path, Gemini handles PDF directly)
    const [pdfPath, setPdfPath] = useState(initialPdfPath)
    const [pdfFileName, setPdfFileName] = useState(initialPdfName)
    const [isLoadingPdf, setIsLoadingPdf] = useState(false)
    const [isDemoMode, setIsDemoMode] = useState(false)

    // Ref to track previous props to prevent dependency cycle
    const prevInitialPathRef = React.useRef(initialPdfPath)
    const prevInitialNameRef = React.useRef(initialPdfName)

    // Sync with props if they change (e.g. user changes file in background)
    // Uses ref comparison to avoid infinite loop from pdfPath dependency
    useEffect(() => {
        const pathChanged = initialPdfPath && initialPdfPath !== prevInitialPathRef.current
        const nameChanged = initialPdfName && initialPdfName !== prevInitialNameRef.current

        if (pathChanged || nameChanged) {
            prevInitialPathRef.current = initialPdfPath
            prevInitialNameRef.current = initialPdfName

            if (pathChanged) setPdfPath(initialPdfPath)
            setPdfFileName(initialPdfName || t?.('quiz_pdf_file_default') || 'PDF Dosyası')

            if (pathChanged) setIsDemoMode(false)
        }
    }, [initialPdfPath, initialPdfName, t])

    // Keep a ref for usedQuestions to avoid adding it to callback dependencies
    const usedQuestionsRef = React.useRef(usedQuestions)
    useEffect(() => {
        usedQuestionsRef.current = usedQuestions
    }, [usedQuestions])

    // Load PDF Function - just selects PDF and stores path
    const handleLoadPdf = useCallback(async () => {
        const api = window.electronAPI
        if (!api?.selectPdf) {
            setError(t?.('error_api_unavailable') || 'PDF API kullanılamıyor')
            return
        }

        setIsLoadingPdf(true)
        setError(null)

        try {
            const result = await api.selectPdf({ filterName: t?.('quiz_filter_name') || 'PDF Dosyaları' })

            if (!isMountedRef.current) return

            if (!result) {
                if (isMountedRef.current) {
                    setIsLoadingPdf(false)
                }
                return
            }

            // Store path - PDF will be sent directly to Gemini API
            setPdfPath(result.path)
            setPdfFileName(result.name || t?.('quiz_pdf_file_default') || 'PDF Dosyası')
        } catch (err: unknown) {
            if (!isMountedRef.current) return
            console.error('[QuizModule] PDF load error:', err)
            const message = err instanceof Error ? err.message : t?.('error_pdf_load') || 'PDF seçilemedi'
            setError(message)
        } finally {
            if (isMountedRef.current) {
                setIsLoadingPdf(false)
                // If user explicitly loads a PDF, we are definitely not in demo mode anymore
                setIsDemoMode(false)
            }
        }
    }, [t])

    // PERSISTENCE: Load settings on mount
    useEffect(() => {
        let active = true
        async function loadSettings() {
            try {
                const saved = await getQuizSettings()
                if (active && saved) {
                    setSettings(s => ({ ...s, ...saved }))
                }
            } catch (e) {
                console.error('[QuizModule] Failed to load settings:', e)
            }
        }
        loadSettings()
        return () => { active = false }
    }, [])

    // PERSISTENCE: Save settings when they change (using a debounce or save-on-action approach)
    // Here we save whenever valid settings are present and changed, but limited to once per 2s to safe IO
    useEffect(() => {
        const timer = setTimeout(() => {
            if (settings) {
                saveQuizSettings(settings).catch(err => console.error('Failed to save settings:', err))
            }
        }, 1500)
        return () => clearTimeout(timer)
    }, [settings])

    // Race condition prevention
    const requestIdRef = React.useRef(0)
    const isMountedRef = React.useRef(true)

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    // Start Quiz Generation
    const handleStartQuiz = useCallback(async (mode?: boolean) => {
        // If mode is passed explicitly (boolean), use it. Otherwise fall back to current state.
        const targetIsDemo = typeof mode === 'boolean' ? mode : isDemoMode

        if (!targetIsDemo && !pdfPath) {
            setError(t?.('quiz_no_pdf') || 'PDF dosyası seçilmedi')
            return
        }

        // Cancel previous requests implicitly by incrementing ID
        const currentRequestId = ++requestIdRef.current

        try {
            setLoadingMessage(targetIsDemo
                ? (t?.('quiz_demo_loading') || 'Demo sınav hazırlanıyor...')
                : (t?.('quiz_generating') || 'Sorular oluşturuluyor...')
            )
            setStep(QuizStep.GENERATING)
            setError(null)

            // Update state to match actual execution mode
            setIsDemoMode(targetIsDemo)

            const questions = await generateQuizQuestions(
                targetIsDemo ? 'DEMO' : pdfPath,
                settings,
                language,
                [],
                targetIsDemo ? [] : usedQuestionsRef.current
            )

            if (!isMountedRef.current) return

            // Race condition check: If ID changed, this request is stale
            if (currentRequestId !== requestIdRef.current) {
                return
            }

            setQuizState({
                ...INITIAL_QUIZ_STATE,
                questions
            })
            setStep(QuizStep.READY)
        } catch (err: unknown) {
            if (!isMountedRef.current) return

            // Only show error if this is still the active request
            if (currentRequestId === requestIdRef.current) {
                console.error('[QuizModule] Generation error:', err)
                const message = err instanceof Error ? err.message : t?.('quiz_error') || 'Sınav oluşturulamadı'
                setError(message)
                setStep(QuizStep.CONFIG)
            }
        }
    }, [pdfPath, settings, language, t, isDemoMode])

    // Demo Quiz Start
    const handleStartDemo = useCallback(() => {
        handleStartQuiz(true)
    }, [handleStartQuiz])



    // Start Active Quiz (after READY)
    const handleStartActiveQuiz = useCallback(() => {
        setQuizState(prev => ({
            ...prev,
            startTime: Date.now()
        }))
        setStep(QuizStep.QUIZ)
    }, [])

    // Finish Quiz
    const handleFinishQuiz = useCallback(() => {
        const correctCount = quizState.questions.reduce((acc, q) => {
            const ans = quizState.userAnswers[q.id]
            return acc + (ans !== undefined && ans === q.correctAnswerIndex ? 1 : 0)
        }, 0)

        setQuizState(prev => ({
            ...prev,
            score: correctCount,
            isFinished: true,
            endTime: Date.now()
        }))
        setStep(QuizStep.RESULTS)
    }, [quizState.questions, quizState.userAnswers])

    // Restart Quiz
    const handleRestart = useCallback(() => {
        // Increment request ID to cancel any pending generations
        requestIdRef.current++
        setQuizState(INITIAL_QUIZ_STATE)
        setUsedQuestions([])
        setIsDemoMode(false)
        setStep(QuizStep.CONFIG)
    }, [])

    // Regenerate (new questions from same PDF or Demo)
    const handleRegenerate = useCallback(() => {
        // Increment request ID to cancel any pending generations
        requestIdRef.current++
        setUsedQuestions(prev => [...prev, ...quizState.questions])
        setQuizState(INITIAL_QUIZ_STATE)
        setStep(QuizStep.CONFIG)
    }, [quizState.questions])

    // Retry Mistakes
    const handleRetryMistakes = useCallback(async () => {
        const failedQuestions = quizState.questions.filter(q => {
            const answer = quizState.userAnswers[q.id]
            return answer === undefined || answer !== q.correctAnswerIndex
        })

        if (failedQuestions.length === 0) return

        // Create the updated list first to ensure consistency
        const updatedUsedQuestions = [...usedQuestions, ...quizState.questions]

        // Cancel previous requests
        const currentRequestId = ++requestIdRef.current

        try {
            setLoadingMessage(t?.('quiz_remedial') || 'Eksik konular için sorular hazırlanıyor...')
            setStep(QuizStep.GENERATING)

            const questions = await generateQuizQuestions(
                isDemoMode ? 'DEMO' : pdfPath,
                settings,
                language,
                failedQuestions,
                updatedUsedQuestions
            )

            if (!isMountedRef.current) return

            // Race condition check
            if (currentRequestId !== requestIdRef.current) {
                return
            }

            // Update state with the new list ONLY on success
            setUsedQuestions(updatedUsedQuestions)

            setQuizState({
                ...INITIAL_QUIZ_STATE,
                questions
            })
            setStep(QuizStep.READY)
        } catch (err: unknown) {
            if (!isMountedRef.current) return

            if (currentRequestId === requestIdRef.current) {
                const message = err instanceof Error ? err.message : t?.('quiz_error') || 'Sınav oluşturulamadı'
                setError(message)
                setStep(QuizStep.RESULTS)
            }
        }
    }, [quizState, pdfPath, settings, t, language, isDemoMode, usedQuestions])

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
                        <h2 className="text-lg font-bold text-white/90">{t?.('quiz_title') || 'Quiz Oluştur'}</h2>
                        <p className="text-xs text-white/40">{pdfFileName || t?.('quiz_subtitle') || 'PDF içeriğinden sorular üret'}</p>
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
                            isRegenerating={usedQuestions.length > 0}
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
                                <h2 className="text-2xl font-bold text-white mb-2">{t?.('quiz_ready') || 'Sınav Hazır!'}</h2>
                                <p className="text-white/50 mb-8">
                                    {quizState.questions.length} {t?.('quiz_ready_count') || 'soru hazırlandı'}
                                </p>
                                <button
                                    onClick={handleStartActiveQuiz}
                                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-105 transition-all"
                                >
                                    {t?.('quiz_start') || 'Sınava Başla'}
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
