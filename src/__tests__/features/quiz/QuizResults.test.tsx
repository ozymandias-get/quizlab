import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuizResults from '@src/features/quiz/components/QuizResults'
import { QuizState } from '@src/features/quiz/types'

// Mock dependencies
vi.mock('@src/features/quiz/hooks/useQuizStats', () => ({
    useQuizStats: (quizState: QuizState) => {
        // Simple mock calculation or just return fixed values for testing
        // Let's rely on the passed state to simulate stats
        const correct = quizState.score // assuming score holds correct count for this mock
        const total = quizState.questions.length
        return {
            correct,
            wrong: total - correct, // simplistic
            empty: 0,
            total,
            percentage: (correct / total) * 100,
            timeStr: '01:00'
        }
    },
}))

vi.mock('@src/components/ui/ConfettiCanvas', () => ({
    default: () => <div data-testid="confetti-canvas" />
}))

// Mock formatQuizText
vi.mock('@src/utils/uiUtils', () => ({
    formatQuizText: (text: string) => text,
}))

const mockQuestions = [
    {
        id: '1',
        text: 'Question 1',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctAnswerIndex: 0,
        explanation: 'Exp 1',
    },
    {
        id: '2',
        text: 'Question 2',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctAnswerIndex: 1,
        explanation: 'Exp 2',
    },
]

const mockState: QuizState = {
    questions: mockQuestions,
    currentQuestionIndex: 1,
    userAnswers: {
        '1': 0, // Correct
        '2': 2, // Wrong (Correct is 1)
    },
    startTime: 1000,
    endTime: 2000,
    score: 1,
    isFinished: true,
}

const mockSettings = {
    difficulty: 'Easy',
    questionCount: 2,
    // other settings...
} as any

describe('QuizResults Component', () => {
    const onRestart = vi.fn()
    const onRegenerate = vi.fn()
    const onRetryMistakes = vi.fn()
    const t = (key: string) => key

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders score and stats', () => {
        render(
            <QuizResults
                quizState={mockState}
                settings={mockSettings}
                onRestart={onRestart}
                onRegenerate={onRegenerate}
                onRetryMistakes={onRetryMistakes}
                t={t}
            />
        )

        // Score is 1/2 = 50%
        // We might have multiple "1"s (score, correct count, etc.)
        const ones = screen.getAllByText('1')
        expect(ones.length).toBeGreaterThan(0)

        expect(screen.getAllByText('quiz_correct_label').length).toBeGreaterThan(0)

        // Check for grade text (50% -> Average)
        expect(screen.getByText('quiz_grade_average')).toBeInTheDocument()
    })

    it('renders action buttons', () => {
        render(
            <QuizResults
                quizState={mockState}
                settings={mockSettings}
                onRestart={onRestart}
                onRegenerate={onRegenerate}
                onRetryMistakes={onRetryMistakes}
                t={t}
            />
        )

        fireEvent.click(screen.getByText('quiz_restart'))
        expect(onRestart).toHaveBeenCalled()

        fireEvent.click(screen.getByText('quiz_regenerate'))
        expect(onRegenerate).toHaveBeenCalled()

        // Since we have 1 wrong answer, retry button should be visible
        const retryBtn = screen.getByText('quiz_retry_mistakes')
        expect(retryBtn).toBeInTheDocument()
        fireEvent.click(retryBtn)
        expect(onRetryMistakes).toHaveBeenCalled()
    })

    it('renders question reviews', () => {
        render(
            <QuizResults
                quizState={mockState}
                settings={mockSettings}
                onRestart={onRestart}
                onRegenerate={onRegenerate}
                onRetryMistakes={onRetryMistakes}
                t={t}
            />
        )

        expect(screen.getByText(/1. Question 1/)).toBeInTheDocument()
        expect(screen.getByText(/2. Question 2/)).toBeInTheDocument()
    })

    it('toggles question expansion', () => {
        render(
            <QuizResults
                quizState={mockState}
                settings={mockSettings}
                onRestart={onRestart}
                onRegenerate={onRegenerate}
                onRetryMistakes={onRetryMistakes}
                t={t}
            />
        )

        // Find expand button for Question 1
        // The question text is inside a button
        const q1Btn = screen.getByText(/1. Question 1/).closest('button')
        expect(q1Btn).toBeInTheDocument()

        if (q1Btn) {
            fireEvent.click(q1Btn)
            // Should show explanation
            expect(screen.getByText('Exp 1')).toBeInTheDocument()
        }
    })
})
