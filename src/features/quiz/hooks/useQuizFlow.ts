import { useState, useCallback, useEffect, useRef } from 'react'
import { Logger } from '@src/utils/logger'
import { useLanguage } from '@src/app/providers/LanguageContext'
import {
    generateQuizQuestions,
    DEFAULT_SETTINGS,
    QuizSettings,
    Question,
    getQuizSettings,
    saveQuizSettings,
    INITIAL_QUIZ_STATE
} from '@src/features/quiz/api'
import { QuizState, QuizStep, QuizStepType } from '../types'

interface UseQuizFlowProps {
    initialPdfPath?: string;
    initialPdfName?: string;
}

export function useQuizFlow({ initialPdfPath = '', initialPdfName = '' }: UseQuizFlowProps) {
    const { t, language } = useLanguage()

    // Quiz State Management
    const [step, setStep] = useState<QuizStepType>(QuizStep.CONFIG)
    const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS)
    const [quizState, setQuizState] = useState<QuizState>(INITIAL_QUIZ_STATE)
    const [error, setError] = useState<string | null>(null)
    const [loadingMessage, setLoadingMessage] = useState('')
    const [usedQuestions, setUsedQuestions] = useState<Question[]>([])

    // PDF State
    const [pdfPath, setPdfPath] = useState(initialPdfPath)
    const [pdfFileName, setPdfFileName] = useState(initialPdfName)
    const [isLoadingPdf, setIsLoadingPdf] = useState(false)
    const [isDemoMode, setIsDemoMode] = useState(false)

    // Refs
    const usedQuestionsRef = useRef(usedQuestions)
    const requestIdRef = useRef(0)
    const isMountedRef = useRef(true)
    const prevInitialPathRef = useRef(initialPdfPath)
    const prevInitialNameRef = useRef(initialPdfName)

    // Sync ref
    useEffect(() => {
        usedQuestionsRef.current = usedQuestions
    }, [usedQuestions])

    // Mount check
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    // Sync with initial props
    useEffect(() => {
        const pathChanged = initialPdfPath && initialPdfPath !== prevInitialPathRef.current
        const nameChanged = initialPdfName && initialPdfName !== prevInitialNameRef.current

        if (pathChanged || nameChanged) {
            prevInitialPathRef.current = initialPdfPath
            prevInitialNameRef.current = initialPdfName

            if (pathChanged) setPdfPath(initialPdfPath)
            setPdfFileName(initialPdfName || t('quiz_pdf_file_default'))

            if (pathChanged) setIsDemoMode(false)
        }
    }, [initialPdfPath, initialPdfName, t])

    // Load Settings
    useEffect(() => {
        let active = true
        async function loadSettings() {
            try {
                const saved = await getQuizSettings()
                if (active && saved) {
                    setSettings(s => ({ ...s, ...saved }))
                }
            } catch (e) {
                Logger.error('[QuizModule] Failed to load settings:', e)
            }
        }
        loadSettings()
        return () => { active = false }
    }, [])

    // Save Settings
    useEffect(() => {
        const timer = setTimeout(() => {
            if (settings) {
                saveQuizSettings(settings).catch(err => Logger.error('Failed to save settings:', err))
            }
        }, 1500)
        return () => clearTimeout(timer)
    }, [settings])

    // Load PDF
    const handleLoadPdf = useCallback(async () => {
        const api = window.electronAPI
        if (!api?.selectPdf) {
            setError(t('error_api_unavailable'))
            return
        }

        setIsLoadingPdf(true)
        setError(null)

        try {
            const result = await api.selectPdf({ filterName: t('quiz_filter_name') })

            if (!isMountedRef.current) return

            if (!result) {
                if (isMountedRef.current) {
                    setIsLoadingPdf(false)
                }
                return
            }

            setPdfPath(result.path)
            setPdfFileName(result.name || t('quiz_pdf_file_default'))
        } catch (err: unknown) {
            if (!isMountedRef.current) return
            Logger.error('[QuizModule] PDF load error:', err)
            const message = err instanceof Error ? (err.message.startsWith('error_') ? t(err.message) : err.message) : t('error_pdf_load')
            setError(message)
        } finally {
            if (isMountedRef.current) {
                setIsLoadingPdf(false)
                setIsDemoMode(false)
            }
        }
    }, [t])

    // Start Quiz Generation
    const handleStartQuiz = useCallback(async (mode?: boolean) => {
        const targetIsDemo = typeof mode === 'boolean' ? mode : isDemoMode

        if (!targetIsDemo && !pdfPath) {
            setError(t('quiz_no_pdf'))
            return
        }

        const currentRequestId = ++requestIdRef.current

        try {
            setLoadingMessage(targetIsDemo
                ? t('quiz_demo_loading')
                : t('quiz_generating')
            )
            setStep(QuizStep.GENERATING)
            setError(null)

            setIsDemoMode(targetIsDemo)

            const questions = await generateQuizQuestions(
                targetIsDemo ? 'DEMO' : pdfPath,
                settings,
                language,
                [],
                targetIsDemo ? [] : usedQuestionsRef.current
            )

            if (!isMountedRef.current) return

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

            if (currentRequestId === requestIdRef.current) {
                Logger.error('[QuizModule] Generation error:', err)
                const message = err instanceof Error ? (err.message.startsWith('error_') ? t(err.message) : err.message) : t('quiz_error')
                setError(message)
                setStep(QuizStep.CONFIG)
            }
        }
    }, [pdfPath, settings, language, t, isDemoMode])

    const handleStartDemo = useCallback(() => {
        handleStartQuiz(true)
    }, [handleStartQuiz])

    const handleStartActiveQuiz = useCallback(() => {
        setQuizState(prev => ({
            ...prev,
            startTime: Date.now()
        }))
        setStep(QuizStep.QUIZ)
    }, [])

    const handleFinishQuiz = useCallback(() => {
        setQuizState(prev => {
            const correctCount = prev.questions.reduce((acc, q) => {
                const ans = prev.userAnswers[q.id]
                return acc + (ans !== undefined && ans === q.correctAnswerIndex ? 1 : 0)
            }, 0)

            return {
                ...prev,
                score: correctCount,
                isFinished: true,
                endTime: Date.now()
            }
        })
        setStep(QuizStep.RESULTS)
    }, [])

    const handleRestart = useCallback(() => {
        requestIdRef.current++
        setQuizState(INITIAL_QUIZ_STATE)
        setUsedQuestions([])
        setIsDemoMode(false)
        setStep(QuizStep.CONFIG)
    }, [])

    const handleRegenerate = useCallback(() => {
        requestIdRef.current++
        setUsedQuestions(prev => [...prev, ...quizState.questions])
        setQuizState(INITIAL_QUIZ_STATE)
        setStep(QuizStep.CONFIG)
    }, [quizState.questions])

    const handleRetryMistakes = useCallback(async () => {
        const failedQuestions = quizState.questions.filter(q => {
            const answer = quizState.userAnswers[q.id]
            return answer === undefined || answer !== q.correctAnswerIndex
        })

        if (failedQuestions.length === 0) return

        const updatedUsedQuestions = [...usedQuestions, ...quizState.questions]
        const currentRequestId = ++requestIdRef.current

        try {
            setLoadingMessage(t('quiz_remedial'))
            setStep(QuizStep.GENERATING)

            const questions = await generateQuizQuestions(
                isDemoMode ? 'DEMO' : pdfPath,
                settings,
                language,
                failedQuestions,
                updatedUsedQuestions
            )

            if (!isMountedRef.current) return

            if (currentRequestId !== requestIdRef.current) {
                return
            }

            setUsedQuestions(updatedUsedQuestions)

            setQuizState({
                ...INITIAL_QUIZ_STATE,
                questions
            })
            setStep(QuizStep.READY)
        } catch (err: unknown) {
            if (!isMountedRef.current) return

            if (currentRequestId === requestIdRef.current) {
                const message = err instanceof Error ? (err.message.startsWith('error_') ? t(err.message) : err.message) : t('quiz_error')
                setError(message)
                setStep(QuizStep.RESULTS)
            }
        }
    }, [quizState.questions, quizState.userAnswers, isDemoMode, pdfPath, settings, language, usedQuestions, t])

    return {
        step,
        setStep,
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
    }
}
