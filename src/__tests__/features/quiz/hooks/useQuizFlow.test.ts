import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useQuizFlow } from '../../../../features/quiz/hooks/useQuizFlow'
import { QuizStep } from '../../../../features/quiz/types'

// Mock dependencies
const mockGenerateQuizQuestions = vi.fn()
const mockGetQuizSettings = vi.fn()
const mockSaveQuizSettings = vi.fn()
const mockSelectPdf = vi.fn()

vi.mock('@src/features/quiz/api', () => ({
    generateQuizQuestions: (...args: any[]) => mockGenerateQuizQuestions(...args),
    getQuizSettings: () => mockGetQuizSettings(),
    saveQuizSettings: (s: any) => mockSaveQuizSettings(s),
    DEFAULT_SETTINGS: { questionCount: 5 },
    INITIAL_QUIZ_STATE: {
        questions: [],
        userAnswers: {},
        score: 0,
        isFinished: false,
        currentQuestionIndex: 0
    },
    QuizSettings: {},
    Question: {}
}))

vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        language: 'en'
    })
}))

vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}))

// Mock window.electronAPI
const originalElectronAPI = window.electronAPI

describe('useQuizFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        window.electronAPI = {
            selectPdf: mockSelectPdf,
            // Add other methods if needed
        } as any

        mockGetQuizSettings.mockResolvedValue({ questionCount: 10 })
        mockSaveQuizSettings.mockResolvedValue({})
        mockGenerateQuizQuestions.mockResolvedValue([
            { id: '1', question: 'Q1', correctAnswerIndex: 0, options: ['A', 'B'] }
        ])
    })

    afterEach(() => {
        window.electronAPI = originalElectronAPI
    })

    it('initializes with default state and loads settings', async () => {
        const { result } = renderHook(() => useQuizFlow({}))

        expect(result.current.step).toBe(QuizStep.CONFIG)
        expect(result.current.pdfPath).toBe('')

        // Settings are loaded async
        await waitFor(() => {
            expect(mockGetQuizSettings).toHaveBeenCalled()
            expect(result.current.settings.questionCount).toBe(10)
        })
    })

    it('initializes with provided PDF props', () => {
        const { result } = renderHook(() => useQuizFlow({
            initialPdfPath: 'path/to.pdf',
            initialPdfName: 'doc.pdf'
        }))

        expect(result.current.pdfPath).toBe('path/to.pdf')
        expect(result.current.pdfFileName).toBe('doc.pdf')
    })

    it('loads PDF via electron API', async () => {
        mockSelectPdf.mockResolvedValue({ path: 'new.pdf', name: 'New Doc' })

        const { result } = renderHook(() => useQuizFlow({}))

        await act(async () => {
            await result.current.handleLoadPdf()
        })

        expect(mockSelectPdf).toHaveBeenCalled()
        expect(result.current.pdfPath).toBe('new.pdf')
        expect(result.current.pdfFileName).toBe('New Doc')
        expect(result.current.error).toBeNull()
    })

    it('handles PDF load error', async () => {
        mockSelectPdf.mockRejectedValue(new Error('Load Failed'))

        const { result } = renderHook(() => useQuizFlow({}))

        await act(async () => {
            await result.current.handleLoadPdf()
        })

        expect(result.current.pdfPath).toBe('')
        // Error message might be localized key or message
        // t('error_pdf_load') or err.message
        // Implementation logic check:
        // const message = err instanceof Error ? (err.message.startsWith('error_') ? t(err.message) : err.message) : t('error_pdf_load')
        // We mocked t(key) => key.
        // So expected 'Load Failed' or 'error_pdf_load' if it falls back?
        // Wait, logic says: if it's Error, use message.
        // So 'Load Failed'.
    })

    it('starts quiz generation successfully', async () => {
        const { result } = renderHook(() => useQuizFlow({ initialPdfPath: 'test.pdf' }))

        // Wait for settings to actually update
        await waitFor(() => {
            expect(result.current.settings.questionCount).toBe(10)
        })

        await act(async () => {
            await result.current.handleStartQuiz()
        })

        // Should call generate
        expect(mockGenerateQuizQuestions).toHaveBeenCalledWith(
            'test.pdf',
            expect.objectContaining({ questionCount: 10 }), // loaded settings
            'en',
            [], // failed questions
            [] // used questions
        )

        expect(result.current.step).toBe(QuizStep.READY)
        expect(result.current.quizState.questions).toHaveLength(1)
    })

    it('handles generation error', async () => {
        mockGenerateQuizQuestions.mockRejectedValue(new Error('Gen Failed'))
        const { result } = renderHook(() => useQuizFlow({ initialPdfPath: 'test.pdf' }))

        await act(async () => {
            await result.current.handleStartQuiz()
        })

        expect(result.current.step).toBe(QuizStep.CONFIG)
        // Error check
    })

    it('transitions to active quiz', () => {
        const { result } = renderHook(() => useQuizFlow({}))

        act(() => {
            result.current.handleStartActiveQuiz()
        })

        expect(result.current.step).toBe(QuizStep.QUIZ)
        expect(result.current.quizState.startTime).toBeDefined()
    })

    it('finishes quiz and calculates score', () => {
        const { result } = renderHook(() => useQuizFlow({}))

        // Setup quiz state manually via setQuizState if exposed, 
        // or assuming it was generated.
        act(() => {
            result.current.setQuizState({
                questions: [{ id: '1', correctAnswerIndex: 0 } as any],
                userAnswers: { '1': 0 }, // Correct
                score: 0,
                isFinished: false,
                currentQuestionIndex: 0,
                startTime: 1000,
                endTime: null
            })
        })

        act(() => {
            result.current.handleFinishQuiz()
        })

        expect(result.current.step).toBe(QuizStep.RESULTS)
        expect(result.current.quizState.isFinished).toBe(true)
        expect(result.current.quizState.score).toBe(1)
        expect(result.current.quizState.endTime).toBeDefined()
    })

    it('debounces settings save', async () => {
        vi.useFakeTimers()
        const { result } = renderHook(() => useQuizFlow({}))

        // Wait for initial load if necessary, but we mock it.
        // We will assert save is called after delay.

        act(() => {
            result.current.setSettings(prev => ({ ...prev, questionCount: 20 }))
        })

        expect(mockSaveQuizSettings).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(1500)
        })

        expect(mockSaveQuizSettings).toHaveBeenCalledWith(expect.objectContaining({ questionCount: 20 }))
        vi.useRealTimers()
    })
})
