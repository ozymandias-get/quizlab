import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useQuizFlow } from '../../../../features/quiz/hooks/useQuizFlow'
import { QuizStep } from '../../../../features/quiz/types'
import { DEFAULT_SETTINGS } from '@features/quiz/api'

// Mock dependencies
const mockMutate = vi.fn()
const mockGenerateMutate = vi.fn()
const mockSelectPdfMutate = vi.fn()

// 1. Mock useQuizApi (React Query hooks)
vi.mock('@platform/electron/api/useQuizApi', () => ({
    useQuizSettings: () => ({
        data: { ...DEFAULT_SETTINGS, questionCount: 10 },
        isLoading: false
    }),
    useSaveSettings: () => ({
        mutate: mockMutate
    }),
    useGenerateQuiz: () => ({
        mutateAsync: mockGenerateMutate,
        isPending: false
    })
}))

// 2. Mock usePdfApi
vi.mock('@platform/electron/api/usePdfApi', () => ({
    useSelectPdf: () => ({
        mutateAsync: mockSelectPdfMutate,
        isPending: false
    })
}))

// 3. Mock Language Context
vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        language: 'en'
    })
}))

// 4. Mock Logger
vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}))

describe('useQuizFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default: selectPdf succeeds
        mockSelectPdfMutate.mockResolvedValue({ path: 'new.pdf', name: 'New Doc' })

        // Default: generateQuiz succeeds
        mockGenerateMutate.mockResolvedValue({
            success: true,
            data: [{ id: '1', question: 'Q1', correctAnswerIndex: 0, options: ['A', 'B'] }]
        })
    })

    it('initializes with default state and loads settings from query', async () => {
        const { result } = renderHook(() => useQuizFlow({}))

        expect(result.current.step).toBe(QuizStep.CONFIG)
        expect(result.current.pdfPath).toBe('')
        expect(result.current.settings.questionCount).toBe(10) // From mocked useQuizSettings
    })

    it('initializes with provided PDF props', () => {
        const { result } = renderHook(() => useQuizFlow({
            initialPdfPath: 'path/to.pdf',
            initialPdfName: 'doc.pdf'
        }))

        expect(result.current.pdfPath).toBe('path/to.pdf')
        expect(result.current.pdfFileName).toBe('doc.pdf')
    })

    it('loads PDF via mutation', async () => {
        const { result } = renderHook(() => useQuizFlow({}))

        await act(async () => {
            await result.current.handleLoadPdf()
        })

        expect(mockSelectPdfMutate).toHaveBeenCalled()
        expect(result.current.pdfPath).toBe('new.pdf')
        expect(result.current.pdfFileName).toBe('New Doc')
        expect(result.current.error).toBeNull()
    })

    it('handles PDF load error', async () => {
        mockSelectPdfMutate.mockRejectedValue(new Error('Load Failed'))
        const { result } = renderHook(() => useQuizFlow({}))

        await act(async () => {
            await result.current.handleLoadPdf()
        })

        // Error handling logic: if Error object, uses message
        expect(result.current.error).toBe('Load Failed')
    })

    it('starts quiz generation successfully via mutation', async () => {
        const { result } = renderHook(() => useQuizFlow({ initialPdfPath: 'test.pdf' }))

        await act(async () => {
            await result.current.handleStartQuiz()
        })

        // Check correct arguments passed to mutation
        expect(mockGenerateMutate).toHaveBeenCalledWith(expect.objectContaining({
            pdfPath: 'test.pdf',
            settings: expect.objectContaining({ questionCount: 10 }), // Check nested settings object
            language: 'en'
        }))

        // On success, it should advance to READY
        expect(result.current.step).toBe(QuizStep.READY)
        // Questions should be set from mutation result
        expect(result.current.quizState.questions).toHaveLength(1)
    })

    it('handles generation error', async () => {
        mockGenerateMutate.mockResolvedValue({ success: false, error: 'Gen Failed' })
        const { result } = renderHook(() => useQuizFlow({ initialPdfPath: 'test.pdf' }))

        await act(async () => {
            await result.current.handleStartQuiz()
        })

        expect(result.current.step).toBe(QuizStep.CONFIG)
        expect(result.current.error).toBe('Gen Failed')
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

        // Manually set quiz state to simulate a completed quiz
        act(() => {
            result.current.setQuizState({
                questions: [{ id: '1', correctAnswerIndex: 0, options: ['A', 'B'], text: 'Q', explanation: '' }],
                userAnswers: { '1': 0 }, // Correct answer for index 0, using question ID '1' as key
                score: 0,
                isFinished: false,
                currentQuestionIndex: 0,
                startTime: Date.now(),
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

    it('debounces settings save via mutation', () => {
        vi.useFakeTimers()
        const { result } = renderHook(() => useQuizFlow({}))

        act(() => {
            result.current.setSettings(prev => ({ ...prev, questionCount: 20 }))
        })

        expect(mockMutate).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(1500)
        })

        expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ questionCount: 20 }))
        vi.useRealTimers()
    })
})

