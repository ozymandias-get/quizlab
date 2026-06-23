import { Logger } from '@shared/lib/logger'

import i18next from 'i18next'
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches subtree render errors and shows a recovery UI. */
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  title?: string
  /**
   * Called *before* the default page reload when the user clicks the
   * "Tekrar Dene" button. Useful for clearing app state, resetting
   * caches, or notifying the host (e.g. Electron main process).
   *
   * When a custom `fallback` is provided, this callback is not invoked —
   * the fallback decides what "retry" means.
   */
  onReset?: () => void
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

const translate = (key: string, params?: Record<string, string>) => i18next.t(key, params)

/**
 * The recovery action for the default "Tekrar Dene" button.
 *
 * We treat the retry as a hard page reload — equivalent to the user
 * pressing `Ctrl+R` — because the most common cause of an error boundary
 * tripping during development is a stale module bundle after HMR or a
 * one-off state inconsistency that survives a soft reset. A clean reload
 * resolves both cases deterministically.
 *
 * The reload is a single line so it stays cheap to override in tests
 * (see `ErrorBoundary.test.tsx`, which stubs `window.location.reload`).
 */
const performHardReload = (): void => {
  if (typeof window !== 'undefined' && typeof window.location.reload === 'function') {
    window.location.reload()
  }
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Logger.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({ errorInfo })
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  /**
   * Default retry handler — invoked by the built-in "Tekrar Dene" button.
   *
   * Order of operations:
   *   1. Notify host via `onReset` (so callers can clear state/log/etc).
   *   2. Reset internal state (so a *non-reload* parent that catches
   *      this signal — e.g. tests — can still recover without a reload).
   *   3. Trigger a hard reload to mirror `Ctrl+R`.
   *
   * The reload is intentionally the last step: it tears down the React
   * tree, so anything that needs to run "before" must run first.
   */
  handleRetry = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset()
      } catch (resetError) {
        Logger.error('[ErrorBoundary] onReset threw:', resetError)
      }
    }
    this.setState({ hasError: false, error: null, errorInfo: null })
    performHardReload()
  }

  handleCopyDetails = async () => {
    const { error, errorInfo } = this.state
    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    const lines = [
      `${translate('error_boundary_title')}: ${this.props.title ?? ''}`.trim(),
      '',
      `Message: ${error?.message ?? '(none)'}`,
      '',
      `Stack: ${error?.stack ?? '(none)'}`,
      '',
      `Component stack:\n${errorInfo?.componentStack ?? '(none)'}`
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch (copyError) {
      Logger.warn('[ErrorBoundary] Clipboard copy failed:', copyError)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleRetry)
      }

      return (
        <ErrorPanel
          error={this.state.error}
          componentStack={this.state.errorInfo?.componentStack ?? null}
          title={this.props.title}
          onRetry={this.handleRetry}
          onCopy={this.handleCopyDetails}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

/* ── Default error panel ─────────────────────────────────────────────── */

interface ErrorPanelProps {
  error: Error | null
  componentStack: string | null
  title?: string
  onRetry: () => void
  onCopy: () => void
}

function ErrorPanel({ error, componentStack, title, onRetry, onCopy }: ErrorPanelProps) {
  return (
    <div
      className="aesthetic-error-boundary"
      role="alert"
      aria-live="assertive"
      data-testid="aesthetic-error-boundary"
    >
      <div className="err-ambient" />
      <div className="err-grid" />

      <div className="err-shell">
        <span className="err-accent-line" aria-hidden="true" />

        <div className="err-markWrap" aria-hidden="true">
          <div className="err-markGlow" />
          <div className="err-mark">
            <AlertTriangle className="h-7 w-7" strokeWidth={2.25} />
          </div>
        </div>

        <h2 className="err-title">{title || translate('error_boundary_title')}</h2>

        {error?.message && (
          <p className="err-message" data-testid="error-boundary-message">
            {error.message}
          </p>
        )}

        <p className="err-hint">
          {translate('error_boundary_kbd_hint', {
            kbd: '\u00A0Ctrl\u00A0+\u00A0R\u00A0'
          })}
        </p>

        <div className="err-actions">
          <button
            type="button"
            onClick={onRetry}
            className="err-btn-primary"
            aria-keyshortcuts="Control+R"
            data-testid="error-boundary-retry"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
            {translate('try_again')}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="err-btn-secondary"
            data-testid="error-boundary-copy"
          >
            <Copy className="h-4 w-4" />
            {translate('error_boundary_copy')}
          </button>
        </div>

        <details className="err-details">
          <summary>{translate('technical_details')}</summary>
          <pre className="err-stack" data-testid="error-boundary-stack">
            {componentStack || translate('no_stack_trace')}
          </pre>
        </details>
      </div>
    </div>
  )
}
