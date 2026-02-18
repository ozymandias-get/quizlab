import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuizModule from '@features/quiz/components/QuizModule'
import { QuizStep } from '@features/quiz/types'

// Mock dependencies
const mockUseQuizFlow = vi.fn()
vi.mock('@features/quiz/hooks/useQuizFlow', () => ({
    useQuizFlow: (props: any) => mockUseQuizFlow(props)
}))

vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

// Mock Subcomponents to verify rendering
vi.mock('@features/quiz/components/QuizConfigPanel', () => ({
    default: () => <div data-testid="quiz-config-panel">Config Panel</div>
}))
vi.mock('@features/quiz/components/QuizGenerating', () => ({
    default: () => <div data-testid="quiz-generating">Generating...</div>
}))
vi.mock('@features/quiz/components/QuizActive', () => ({
    default: () => <div data-testid="quiz-active">Quiz Active</div>
}))
vi.mock('@features/quiz/components/QuizResults', () => ({
    default: () => <div data-testid="quiz-results">Quiz Results</div>
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

// Mock icons
vi.mock('lucide-react', () => ({
    X: () => <svg />,
    Brain: () => <svg />,
    Zap: () => <svg />
}))

describe('QuizModule Component', () => {
    const onClose = vi.fn()

    // Default mock return setup
    const defaultHookReturn = {
        step: QuizStep.CONFIG,
        settings: {},
        setSettings: vi.fn(),
        quizState: { questions: [] },
        setQuizState: vi.fn(),
        error: null,
        loadingMessage: '',
        pdfPath: '',
        pdfFileName: '',
        isLoadingPdf: false,
        isDemoMode: false,
        handleLoadPdf: vi.fn(),
        handleStartQuiz: vi.fn(),
        handleStartDemo: vi.fn(),
        handleStartActiveQuiz: vi.fn(),
        handleFinishQuiz: vi.fn(),
        handleRestart: vi.fn(),
        handleRegenerate: vi.fn(),
        handleRetryMistakes: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseQuizFlow.mockReturnValue(defaultHookReturn)
    })

    it('renders config panel initially', () => {
        mockUseQuizFlow.mockReturnValue({
            ...defaultHookReturn,
            step: QuizStep.CONFIG
        })

        render(<QuizModule onClose={onClose} />)

        expect(screen.getByTestId('quiz-config-panel')).toBeInTheDocument()
        expect(screen.getByText('quiz_title')).toBeInTheDocument()
    })

    it('renders generating state', () => {
        mockUseQuizFlow.mockReturnValue({
            ...defaultHookReturn,
            step: QuizStep.GENERATING,
            loadingMessage: 'Analyzing PDF...'
        })

        render(<QuizModule onClose={onClose} />)

        expect(screen.getByTestId('quiz-generating')).toBeInTheDocument()
    })

    it('renders ready state', () => {
        mockUseQuizFlow.mockReturnValue({
            ...defaultHookReturn,
            step: QuizStep.READY,
            quizState: { questions: [1, 2, 3] } // Mock questions array length
        })

        render(<QuizModule onClose={onClose} />)

        expect(screen.getByText('quiz_ready')).toBeInTheDocument()
        expect(screen.getByText('3 quiz_ready_count')).toBeInTheDocument()

        // Start button in ready screen
        fireEvent.click(screen.getByText('quiz_start'))
        expect(defaultHookReturn.handleStartActiveQuiz).toHaveBeenCalled()
    })

    it('renders active quiz', () => {
        mockUseQuizFlow.mockReturnValue({
            ...defaultHookReturn,
            step: QuizStep.QUIZ
        })

        render(<QuizModule onClose={onClose} />)

        expect(screen.getByTestId('quiz-active')).toBeInTheDocument()
    })

    it('renders results', () => {
        mockUseQuizFlow.mockReturnValue({
            ...defaultHookReturn,
            step: QuizStep.RESULTS
        })

        render(<QuizModule onClose={onClose} />)

        expect(screen.getByTestId('quiz-results')).toBeInTheDocument()
    })

    it('renders error banner', () => {
        mockUseQuizFlow.mockReturnValue({
            ...defaultHookReturn,
            error: 'Something went wrong'
        })

        render(<QuizModule onClose={onClose} />)

        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('calls onClose when close button clicked', () => {
        render(<QuizModule onClose={onClose} />)

        // Close button (X icon)
        // Usually inside header
        // We can find button that contains the X icon or just the only button in header
        const closeBtn = screen.getAllByRole('button')[0] // The header close button is likely the first one
        fireEvent.click(closeBtn)

        expect(onClose).toHaveBeenCalled()
    })
})

