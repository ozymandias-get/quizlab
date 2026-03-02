import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuizActive from '@features/quiz/ui/QuizActive'
import { QuizNavigation } from '@features/quiz/ui/active/QuizNavigation'
import { QuizState } from '@features/quiz/model/types'

vi.mock('@features/quiz/hooks/useQuizTimer', () => ({
    useQuizTimer: () => '00:30'
}))

vi.mock('@shared/lib/uiUtils', async () => {
    const actual = await vi.importActual<typeof import('@shared/lib/uiUtils')>('@shared/lib/uiUtils')
    return {
        ...actual,
        formatQuizText: (text: string) => text
    }
})

vi.mock('@shared/constants/animations', () => ({
    SLIDE_VARIANTS: {}
}))

vi.mock('framer-motion', () => {
    const filterProps = (props: any) => {
        const { whileHover, whileTap, initial, animate, exit, transition, variants, custom, mode, ...rest } = props
        return rest
    }

    return {
        motion: {
            div: ({ children, ...props }: any) => <div {...filterProps(props)}>{children}</div>,
            button: ({ children, ...props }: any) => <button {...filterProps(props)}>{children}</button>,
        },
        AnimatePresence: ({ children }: any) => <>{children}</>,
    }
})

vi.mock('lucide-react', () => {
    const Icon = (props: any) => <svg {...props} data-testid="icon" />
    return {
        ChevronLeft: Icon,
        ChevronRight: Icon,
        CheckCircle: Icon,
        Eraser: Icon,
        Clock: Icon,
        Sparkles: Icon
    }
})

describe('Quiz button regressions', () => {
    const t = (key: string) => key

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps disabled state on previous and clear buttons', () => {
        render(
            <QuizNavigation
                isFirst={true}
                isLast={false}
                navigateQuestion={vi.fn()}
                onFinish={vi.fn()}
                selectedAnswer={undefined}
                handleAnswerToggle={vi.fn()}
                t={t}
            />
        )

        expect(screen.getByText('quiz_back').closest('button')).toBeDisabled()
        expect(screen.getByText('quiz_clear').closest('button')).toBeDisabled()
    })

    it('applies focus-visible classes from shared button base', () => {
        render(
            <QuizNavigation
                isFirst={false}
                isLast={false}
                navigateQuestion={vi.fn()}
                onFinish={vi.fn()}
                selectedAnswer={1}
                handleAnswerToggle={vi.fn()}
                t={t}
            />
        )

        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
        buttons.forEach((button) => {
            expect(button.className).toContain('focus-visible:ring-2')
            expect(button.className).toContain('disabled:opacity-50')
        })
    })

    it('handles keyboard navigation with arrow keys in active quiz', () => {
        const setQuizState = vi.fn()
        const setSlideDirection = vi.fn()

        const quizState: QuizState = {
            questions: [
                {
                    id: 'q1',
                    text: 'Question 1',
                    options: ['Option A', 'Option B'],
                    correctAnswerIndex: 0,
                    explanation: 'Exp 1'
                },
                {
                    id: 'q2',
                    text: 'Question 2',
                    options: ['Option C', 'Option D'],
                    correctAnswerIndex: 1,
                    explanation: 'Exp 2'
                }
            ],
            currentQuestionIndex: 0,
            userAnswers: {},
            score: 0,
            isFinished: false,
            startTime: Date.now(),
            endTime: null
        }

        render(
            <QuizActive
                quizState={quizState}
                setQuizState={setQuizState}
                slideDirection={1}
                setSlideDirection={setSlideDirection}
                onFinish={vi.fn()}
                t={t}
            />
        )

        fireEvent.keyDown(window, { key: 'ArrowRight' })

        expect(setSlideDirection).toHaveBeenCalledWith(1)
        expect(setQuizState).toHaveBeenCalled()
    })
})
