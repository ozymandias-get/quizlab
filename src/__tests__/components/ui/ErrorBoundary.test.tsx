import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'

// Mock Logger
vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn()
    }
}))

vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

const Thrower = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test Error!')
    }
    return <div>Safe Content</div>
}

describe('ErrorBoundary', () => {
    const originalConsoleError = console.error

    beforeEach(() => {
        console.error = vi.fn()
    })

    afterEach(() => {
        console.error = originalConsoleError
        vi.clearAllMocks()
    })

    it('renders children when no error occurs', () => {
        render(
            <ErrorBoundary>
                <Thrower shouldThrow={false} />
            </ErrorBoundary>
        )
        expect(screen.getByText('Safe Content')).toBeInTheDocument()
    })

    it('renders default error UI when error occurs', () => {
        render(
            <ErrorBoundary>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        )
        expect(screen.getByText('error_boundary_title')).toBeInTheDocument()
        expect(screen.getByText(/^Test Error!/)).toBeInTheDocument()
    })

    it('renders custom title if provided', () => {
        render(
            <ErrorBoundary title="Custom Error Title">
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        )
        expect(screen.getByText('Custom Error Title')).toBeInTheDocument()
    })

    it('renders custom fallback if provided', () => {
        const fallback = (error: Error, reset: () => void) => (
            <div>
                <h1>Custom Fallback</h1>
                <p>{error.message}</p>
                <button onClick={reset}>Retry Custom</button>
            </div>
        )

        render(
            <ErrorBoundary fallback={fallback}>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        )

        expect(screen.getByText('Custom Fallback')).toBeInTheDocument()
        expect(screen.getByText('Test Error!')).toBeInTheDocument()
    })

    it('calls onError prop when error is caught', () => {
        const onError = vi.fn()
        render(
            <ErrorBoundary onError={onError}>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        )
        expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ componentStack: expect.any(String) }))
    })

    it('resets error state on retry', () => {
        const onReset = vi.fn()
        render(
            <ErrorBoundary onReset={onReset}>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        )

        expect(screen.getByText('error_boundary_title')).toBeInTheDocument()

        const retryBtn = screen.getByText('try_again')
        fireEvent.click(retryBtn)

        expect(onReset).toHaveBeenCalled()
    })
})
