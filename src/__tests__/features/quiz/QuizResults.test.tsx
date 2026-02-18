import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuizResults from '@features/quiz/components/QuizResults'
import { QuizState } from '@features/quiz/types'

// Mock dependencies
vi.mock('@features/quiz/hooks/useQuizStats', () => ({
    useQuizStats: (quizState: QuizState) => {
        const correct = quizState.score
        const total = quizState.questions.length
        return {
            correct,
            wrong: total - correct,
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

// Mock Virtuoso
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ itemContent, totalCount }: any) => (
        <div data-testid="virtuoso-list">
            {Array.from({ length: totalCount }).map((_, index) => (
                <div key={index} data-testid={`virtuoso-item-${index}`}>
                    {itemContent(index)}
                </div>
            ))}
        </div>
    ),
}))

// Mock QuizQuestionReview to avoid rendering child component that uses hooks
vi.mock('@features/quiz/components/QuizQuestionReview', () => ({
    QuizQuestionReview: ({ question, isExpanded, onToggle }: any) => (
        <div data-testid={`question-review-${question.id}`}>
            <button onClick={onToggle}>
                {question.text} (Expanded: {isExpanded ? 'Yes' : 'No'})
            </button>
            {isExpanded && <div>{question.explanation}</div>}
        </div>
    )
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

        const ones = screen.getAllByText('1')
        expect(ones.length).toBeGreaterThan(0)

        expect(screen.getAllByText('quiz_correct_label').length).toBeGreaterThan(0)
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

        // Since we mocked QuizQuestionReview, we expect the mock text
        expect(screen.getByTestId('question-review-1')).toBeInTheDocument()
        expect(screen.getByTestId('question-review-2')).toBeInTheDocument()
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

        // Find expand button for Question 1 (inside our mock)
        const q1Btn = screen.getByText(/Question 1/).closest('button')
        expect(q1Btn).toBeInTheDocument()

        if (q1Btn) {
            fireEvent.click(q1Btn)
            // Should show explanation (based on our mock implementation)
            // The logic for expansion is controlled by QuizResults state
            // Our mock uses the props passed from QuizResults
            expect(screen.getByText('Exp 1')).toBeInTheDocument()
        }
    })
})

