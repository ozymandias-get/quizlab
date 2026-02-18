import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuizConfigPanel from '@features/quiz/components/QuizConfigPanel'

// Mock dependencies
vi.mock('@features/quiz/api', () => ({
    Difficulty: { EASY: 'EASY', MEDIUM: 'MEDIUM', HARD: 'HARD' },
    QuestionStyle: {
        CLASSIC: 'CLASSIC',
        MIXED: 'MIXED',
        NEGATIVE: 'NEGATIVE'
    },
    QuestionStyleEnum: {
        CLASSIC: 'CLASSIC',
        MIXED: 'MIXED',
        NEGATIVE: 'NEGATIVE'
    },
    STYLE_ICONS: {
        CLASSIC: () => <div data-testid="icon-classic" />,
        MIXED: () => <div data-testid="icon-mixed" />,
        NEGATIVE: () => <div data-testid="icon-negative" />
    },
    getModelConfigs: () => [
        { type: 'model-1', label: 'Model 1', desc: 'Desc 1', icon: () => <div />, color: 'blue' },
        { type: 'model-2', label: 'Model 2', desc: 'Desc 2', icon: () => <div />, color: 'orange' }
    ]
}))

vi.mock('lucide-react', () => {
    const Icon = (props: any) => <svg {...props} data-testid="icon" />
    return {
        Play: Icon,
        Wand2: Icon,
        Brain: Icon,
        Microscope: Icon,
        AlertTriangle: Icon,
        ChevronDown: Icon,
        Upload: Icon,
        Loader2: Icon,
        FileText: Icon,
        Rabbit: Icon,
        Sparkles: Icon,
        Target: Icon,
        Zap: Icon,
        Clock: Icon,
        Languages: Icon,
        BrainCircuit: Icon,
        ChevronRight: Icon,
        RefreshCcw: Icon,
        CheckSquare: Icon,
        XCircle: Icon,
        ListChecks: Icon,
        ArrowUpDown: Icon,
        MoreHorizontal: Icon,
        Lightbulb: Icon,
        ArrowLeftRight: Icon,
        Layers: Icon,
        LucideIcon: Icon
    }
})

vi.mock('framer-motion', () => {
    const filterProps = (props: any) => {
        const { whileHover, whileTap, initial, animate, exit, transition, layout, layoutId, ...rest } = props
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

describe('QuizConfigPanel Component', () => {
    const setSettings = vi.fn()
    const onStartQuiz = vi.fn()
    const onLoadPdf = vi.fn()
    const t = (key: string) => key

    const defaultSettings = {
        questionCount: 10,
        difficulty: 'MEDIUM',
        model: 'model-1',
        style: ['MIXED'],
        topic: '',
        focusTopic: ''
    } as any

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders PDF upload section', () => {
        render(
            <QuizConfigPanel
                settings={defaultSettings}
                setSettings={setSettings}
                onStartQuiz={onStartQuiz}
                onLoadPdf={onLoadPdf}
                t={t}
            />
        )

        // There might be multiple "quiz_pdf_select" texts (description and button)
        const texts = screen.getAllByText('quiz_pdf_select')
        expect(texts.length).toBeGreaterThan(0)

        // Find the button to click
        // Assuming the button contains one of these texts
        const uploadBtn = texts.map(t => t.closest('button')).find(btn => btn !== null)

        if (uploadBtn) {
            fireEvent.click(uploadBtn)
            expect(onLoadPdf).toHaveBeenCalled()
        }
    })

    it('renders PDF ready state', () => {
        render(
            <QuizConfigPanel
                settings={defaultSettings}
                setSettings={setSettings}
                onStartQuiz={onStartQuiz}
                onLoadPdf={onLoadPdf}
                pdfPath="/path/to/doc.pdf"
                fileName="doc.pdf"
                t={t}
            />
        )

        expect(screen.getByText('quiz_pdf_ready')).toBeInTheDocument()
    })

    it('validates start button', () => {
        const { rerender } = render(
            <QuizConfigPanel
                settings={defaultSettings}
                setSettings={setSettings}
                onStartQuiz={onStartQuiz}
                onLoadPdf={onLoadPdf}
                t={t}
            />
        )

        const startBtn = screen.getByText('quiz_create').closest('button')
        expect(startBtn).toBeDisabled()

        rerender(
            <QuizConfigPanel
                settings={defaultSettings}
                setSettings={setSettings}
                onStartQuiz={onStartQuiz}
                onLoadPdf={onLoadPdf}
                t={t}
                pdfPath="valid"
            />
        )
        const startBtnEnabled = screen.getByText('quiz_create').closest('button')
        expect(startBtnEnabled).not.toBeDisabled()
    })
})

