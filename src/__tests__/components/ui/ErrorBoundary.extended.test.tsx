import '@shared/i18n/i18next'

import { Logger } from '@shared/lib/logger'
import ErrorBoundary from '@ui/components/ErrorBoundary'

import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn()
  }
}))

const Thrower = ({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) => {
  if (shouldThrow) {
    throw new Error(message || 'Test Error!')
  }
  return <div>Safe Content</div>
}

describe('ErrorBoundary - Recovery Tests', () => {
  const originalConsoleError = console.error
  let reloadMock: ReturnType<typeof vi.fn>

  beforeAll(async () => {
    await i18next.changeLanguage('en')
  })

  beforeEach(() => {
    console.error = vi.fn()
    reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock }
    })
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

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/Test Error!/)).toBeInTheDocument()
  })

  it('shows custom title when provided', () => {
    render(
      <ErrorBoundary title="PDF Hatası">
        <Thrower shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('PDF Hatası')).toBeInTheDocument()
  })

  it('shows custom fallback when provided', () => {
    const fallback = (error: Error, retry: () => void) => (
      <div>
        <h1>Custom UI</h1>
        <p>{error.message}</p>
        <button onClick={retry}>Retry</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={fallback}>
        <Thrower shouldThrow message="Custom error" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom UI')).toBeInTheDocument()
    expect(screen.getByText('Custom error')).toBeInTheDocument()
  })

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('resets to children state after retry (reload stubbed)', () => {
    const onReset = vi.fn()
    render(
      <ErrorBoundary onReset={onReset}>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try Again'))
    expect(onReset).toHaveBeenCalled()
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('shows technical details section', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Technical Details')).toBeInTheDocument()
  })

  it('logs error to Logger when caught', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow message="Logged error" />
      </ErrorBoundary>
    )

    expect(Logger.error).toHaveBeenCalledWith(
      '[ErrorBoundary] Caught error:',
      expect.any(Error),
      expect.any(Object)
    )
  })

  it('triggers a hard reload on retry (Ctrl+R action)', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    expect(reloadMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Try Again'))

    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('does not show error UI for non-error renders', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('shows error message from thrown Error', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow message="Specific error message" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Specific error message')).toBeInTheDocument()
  })

  it('calls onReset before the hard reload', () => {
    const callOrder: string[] = []
    const onReset = vi.fn(() => callOrder.push('onReset'))
    reloadMock.mockImplementation(() => callOrder.push('reload'))

    render(
      <ErrorBoundary onReset={onReset}>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByText('Try Again'))

    expect(callOrder).toEqual(['onReset', 'reload'])
  })

  it('exposes a Ctrl+R keyboard shortcut hint via aria-keyshortcuts', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    const retryBtn = screen.getByRole('button', { name: /try again/i })
    expect(retryBtn).toHaveAttribute('aria-keyshortcuts', 'Control+R')
  })
})
