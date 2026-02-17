import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import QuizGenerating from '../../../features/quiz/components/QuizGenerating'

// Mock icons
vi.mock('lucide-react', () => ({
    Brain: () => <svg data-testid="icon-brain" />,
    Sparkles: () => <svg data-testid="icon-sparkles" />,
    Zap: () => <svg data-testid="icon-zap" />,
    Cpu: () => <svg data-testid="icon-cpu" />,
    FileText: () => <svg data-testid="icon-filetext" />,
    CheckCircle2: () => <svg data-testid="icon-check" />
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('QuizGenerating', () => {
    const t = vi.fn((key) => key)

    beforeEach(() => {
        vi.useFakeTimers()
        t.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders initial state correctly', () => {
        render(<QuizGenerating t={t} />)

        expect(screen.getByText('quiz_gen_title')).toBeInTheDocument()
        // First step is quiz_gen_step1 (FileText)
        expect(screen.getByText('quiz_gen_step1')).toBeInTheDocument()
        expect(screen.getByTestId('icon-filetext')).toBeInTheDocument()
    })

    it('cycles through loading steps over time', () => {
        render(<QuizGenerating t={t} />)

        expect(screen.getByText('quiz_gen_step1')).toBeInTheDocument()

        // Advance 2500ms
        act(() => {
            vi.advanceTimersByTime(2500)
        })

        // Should be step 2
        expect(screen.getByText('quiz_gen_step2')).toBeInTheDocument()
        expect(screen.getByTestId('icon-brain')).toBeInTheDocument()
    })

    it('displays custom message if provided', () => {
        render(<QuizGenerating t={t} message="Custom Loading Message" />)

        expect(screen.getByText('Custom Loading Message')).toBeInTheDocument()
    })

    it('displays default message if no custom message', () => {
        render(<QuizGenerating t={t} />)

        expect(screen.getByText('quiz_gen_desc')).toBeInTheDocument()
    })
})
