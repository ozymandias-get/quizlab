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

  it('renders children normally, and swaps to the error UI when a child throws', () => {
    const { unmount } = render(
      <ErrorBoundary>
        <Thrower shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Safe Content')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    unmount()

    render(
      <ErrorBoundary>
        <Thrower shouldThrow message="Specific error message" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Specific error message')).toBeInTheDocument()
  })

  it('shows a custom fallback render function when provided', () => {
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

  it('resets state and hard-reloads the window on retry', () => {
    const callOrder: string[] = []
    const onReset = vi.fn(() => callOrder.push('onReset'))
    reloadMock.mockImplementation(() => callOrder.push('reload'))

    render(
      <ErrorBoundary onReset={onReset}>
        <Thrower shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try Again'))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(reloadMock).toHaveBeenCalledTimes(1)
    // onReset must run first: consumers use it to clear in-memory state that
    // must not survive the reload.
    expect(callOrder).toEqual(['onReset', 'reload'])
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
