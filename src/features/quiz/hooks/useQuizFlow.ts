import { useState, useCallback, useEffect, useRef } from 'react'
import { Logger } from '@src/utils/logger'
import { useLanguage } from '@src/app/providers/LanguageContext'
import {
    DEFAULT_SETTINGS,
    QuizSettings,
    Question,
    INITIAL_QUIZ_STATE
} from '@features/quiz/api'
import { useQuizSettings, useGenerateQuiz, useSaveSettings } from '@platform/electron/api/useQuizApi'
import { useSelectPdf } from '@platform/electron/api/usePdfApi'
import { QuizState, QuizStep, QuizStepType } from '../types'

interface UseQuizFlowProps {
    initialPdfPath?: string;
    initialPdfName?: string;
}

export function useQuizFlow({ initialPdfPath = '', initialPdfName = '' }: UseQuizFlowProps) {
    const { t, language } = useLanguage()

    const { data: settingsData } = useQuizSettings()
    const { mutate: saveSettings } = useSaveSettings()
    const generateQuizMutation = useGenerateQuiz()
    const { mutateAsync: selectPdf, isPending: isLoadingPdf } = useSelectPdf()

    // Quiz State Management
    const [step, setStep] = useState<QuizStepType>(QuizStep.CONFIG)
    const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS)

    // Sync settings from React Query
    useEffect(() => {
        if (settingsData) {
            setSettings(prev => {
                // Component-level deep comparison to avoid loops
                if (JSON.stringify(prev) !== JSON.stringify(settingsData)) {
                    return { ...prev, ...settingsData }
                }
                return prev
            })
        }
    }, [settingsData])
    const [quizState, setQuizState] = useState<QuizState>(INITIAL_QUIZ_STATE)
    const [error, setError] = useState<string | null>(null)
    const [usedQuestions, setUsedQuestions] = useState<Question[]>([])

    // PDF State
    const [pdfPath, setPdfPath] = useState(initialPdfPath)
    const [pdfFileName, setPdfFileName] = useState(initialPdfName)
    const [isDemoMode, setIsDemoMode] = useState(false)

    // Derived loading state
    const loadingMessage = generateQuizMutation.isPending
        ? (isDemoMode ? t('quiz_demo_loading') : t('quiz_generating'))
        : ''

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

    // Settings loading handled by useQuizSettingsQuery

    // Custom setSettings with debounced save
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleSetSettings = useCallback((newSettingsOrUpdater: QuizSettings | ((prev: QuizSettings) => QuizSettings)) => {
        setSettings(prev => {
            const updated = typeof newSettingsOrUpdater === 'function'
                ? newSettingsOrUpdater(prev)
                : newSettingsOrUpdater

            // Debounce save
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
            saveTimeoutRef.current = setTimeout(() => {
                saveSettings(updated)
            }, 1500)

            return updated
        })
    }, [saveSettings])

    // Load PDF
    const handleLoadPdf = useCallback(async () => {
        setError(null)

        try {
            const result = await selectPdf({ filterName: t('quiz_filter_name') })

            if (!isMountedRef.current) return

            if (!result) return

            setPdfPath(result.path)
            setPdfFileName(result.name || t('quiz_pdf_file_default'))
        } catch (err: unknown) {
            if (!isMountedRef.current) return
            Logger.error('[QuizModule] PDF load error:', err)
            const message = err instanceof Error ? (err.message.startsWith('error_') ? t(err.message) : err.message) : t('error_pdf_load')
            setError(message)
        } finally {
            if (isMountedRef.current) {
                setIsDemoMode(false)
            }
        }
    }, [t, selectPdf])

    // Start Quiz Generation
    const handleStartQuiz = useCallback(async (mode?: boolean) => {
        // Determine if we are starting in demo mode
        // If mode is provided (boolean), use it. Otherwise fall back to current isDemoMode state
        const targetIsDemo = typeof mode === 'boolean' ? mode : isDemoMode

        // Validation: If not demo, we need a PDF
        if (!targetIsDemo && !pdfPath) {
            setError(t('quiz_no_pdf'))
            return
        }

        const currentRequestId = ++requestIdRef.current

        try {
            // Update UI state
            setStep(QuizStep.GENERATING)
            setError(null)
            setError(null)

            // Update mode state
            setIsDemoMode(targetIsDemo)

            const result = await generateQuizMutation.mutateAsync({
                pdfPath: targetIsDemo ? 'DEMO' : pdfPath,
                settings,
                language,
                failedQuestionsContext: [],
                previousQuestions: targetIsDemo ? [] : usedQuestionsRef.current
            })

            // Checks after await
            if (!isMountedRef.current) return
            if (currentRequestId !== requestIdRef.current) return

            if (!result.success) {
                throw new Error(result.error || 'Unknown generation error')
            }

            const questions = result.data as Question[]

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
                // Go back to config on error
                setStep(QuizStep.CONFIG)
            }
        }
    }, [pdfPath, settings, language, t, isDemoMode, generateQuizMutation])

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
            setStep(QuizStep.GENERATING)

            const result = await generateQuizMutation.mutateAsync({
                pdfPath: isDemoMode ? 'DEMO' : pdfPath,
                settings,
                language,
                failedQuestionsContext: failedQuestions,
                previousQuestions: updatedUsedQuestions
            })

            if (!isMountedRef.current) return

            if (currentRequestId !== requestIdRef.current) {
                return
            }

            if (!result.success) {
                throw new Error(result.error || 'Unknown regeneration error')
            }

            const questions = result.data as Question[]

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
        setSettings: handleSetSettings,
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

