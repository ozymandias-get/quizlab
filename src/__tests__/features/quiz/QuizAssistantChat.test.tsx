
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuizAssistantChat } from '@features/quiz/components/review/QuizAssistantChat'
import { useAskAssistant } from '@platform/electron/api/useQuizApi'

// Mock dependencies
vi.mock('@platform/electron/api/useQuizApi', () => ({
    useAskAssistant: vi.fn(() => ({
        mutateAsync: vi.fn(),
        isPending: false,
        isError: false,
        error: null,
    }))
}))

// Mock uiUtils
vi.mock('@src/utils/uiUtils', () => ({
    formatQuizText: (text: string) => `formatted-${text}`
}))

// Mock Logger
vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}))

describe('QuizAssistantChat Component', () => {
    const t = (key: string) => key
    const defaultProps = {
        questionText: 'Test Question',
        explanationText: 'Test Explanation',
        t
    }

    const mockMutateAsync = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        // Default mock implementation for useAskAssistant
        vi.mocked(useAskAssistant).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
            error: null,
        } as any)

        mockMutateAsync.mockResolvedValue({ success: true, data: 'AI Response' })
    })

    it('renders input and button', () => {
        render(<QuizAssistantChat {...defaultProps} />)

        const input = screen.getByPlaceholderText('quiz_ask_placeholder')
        expect(input).toBeInTheDocument()

        const button = screen.getByRole('button')
        expect(button).toBeDisabled() // Input is empty
    })

    it('enables button when text is entered', () => {
        render(<QuizAssistantChat {...defaultProps} />)

        const input = screen.getByPlaceholderText('quiz_ask_placeholder')
        fireEvent.change(input, { target: { value: 'My Question' } })

        const button = screen.getByRole('button')
        expect(button).not.toBeDisabled()
    })

    it('calls askAssistant mutation on send', async () => {
        render(<QuizAssistantChat {...defaultProps} />)

        const input = screen.getByPlaceholderText('quiz_ask_placeholder')
        fireEvent.change(input, { target: { value: 'Why correct?' } })

        const button = screen.getByRole('button')
        fireEvent.click(button)

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledWith({
                question: 'Test Question',
                context: 'formatted-Test Explanation' // from mock formatQuizText
            })
        })
    })

    it('displays AI response on success', async () => {
        mockMutateAsync.mockResolvedValueOnce({
            success: true,
            data: 'Because A is the correct answer.'
        })

        render(<QuizAssistantChat {...defaultProps} />)

        const input = screen.getByPlaceholderText('quiz_ask_placeholder')
        fireEvent.change(input, { target: { value: 'Why?' } })

        const button = screen.getByRole('button')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Because A is the correct answer.')).toBeInTheDocument()
        })

        // Input should be cleared
        expect(input).toHaveValue('')
    })

    it('displays error message when mutation is in error state', () => {
        // Override mock for this test
        vi.mocked(useAskAssistant).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: true,
            error: { message: 'Network Error' }
        } as any)

        render(<QuizAssistantChat {...defaultProps} />)

        expect(screen.getByText('Network Error')).toBeInTheDocument()
    })

    it('displays default error message if error has no message', () => {
        // Override mock for this test
        vi.mocked(useAskAssistant).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: true,
            error: {} // Empty error object
        } as any)

        render(<QuizAssistantChat {...defaultProps} />)

        expect(screen.getByText('error_asking_assistant')).toBeInTheDocument()
    })
})

