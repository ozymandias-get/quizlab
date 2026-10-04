import AiSession from '@features/ai/ui/AiSession'

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const useManagedContentView = vi.fn()

vi.mock('@app/providers/ai-context', () => ({
  useAiRegistryMeta: () => ({
    isRegistryLoaded: true,
    chromeUserAgent: 'mock-user-agent'
  }),
  useAiSites: () => ({
    'gpt-4': { url: 'https://chat.openai.com', displayName: 'ChatGPT' },
    'claude-3': { url: 'https://claude.ai', displayName: 'Claude' },
    'loading-model': { url: 'https://loading.test', displayName: 'Loading' },
    'error-model': { url: 'https://error.test', displayName: 'Broken' }
  }),
  useAiContentHostActions: () => ({
    registerContent: vi.fn()
  })
}))

vi.mock('@shared/hooks/aiContent/useManagedContentView', () => ({
  useManagedContentView: (options: unknown) => useManagedContentView(options)
}))

vi.mock('@shared/hooks/aiContent/aiViewClient', () => ({
  getAiViewClient: () => ({})
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@shared/hooks/aiContent/useAiContentLifecycle', () => ({
  useAiContentLifecycle: ({ currentAI }: { currentAI: string }) => {
    if (currentAI === 'error-model') {
      return {
        isLoading: false,
        error: 'Failed to load',
        hasLoadedOnce: true,
        handleRetry: vi.fn()
      }
    }
    if (currentAI === 'loading-model') {
      return { isLoading: true, error: null, hasLoadedOnce: false, handleRetry: vi.fn() }
    }
    return { isLoading: false, error: null, hasLoadedOnce: true, handleRetry: vi.fn() }
  }
}))

vi.mock('@ui/components/AestheticLoader', () => ({
  default: () => <div data-testid="aesthetic-loader">Loading...</div>
}))

vi.mock('@features/ai/ui/AiErrorView', () => ({
  default: ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <div data-testid="ai-error-view">
      Error: {error}
      <button onClick={onRetry}>Retry</button>
    </div>
  )
}))

const defaultTab = { id: '1', modelId: 'gpt-4', title: 'GPT-4' }

const defaultProps = {
  isSurfaceActive: true,
  isOverlayActive: false
}

describe('AiSession', () => {
  beforeEach(() => {
    useManagedContentView.mockReset()
    useManagedContentView.mockImplementation((options: { modelId: string; isEnabled: boolean }) => {
      const base = {
        isLoading: false,
        error: null as string | null,
        hasLoadedOnce: true,
        handleRetry: vi.fn(),
        setHostElement: vi.fn()
      }
      if (!options.isEnabled) return { ...base, hasLoadedOnce: false }
      if (options.modelId === 'loading-model') {
        return { ...base, isLoading: true, hasLoadedOnce: false }
      }
      if (options.modelId === 'error-model') {
        return { ...base, error: 'Failed to load' }
      }
      return base
    })
  })

  const lastOptions = () => useManagedContentView.mock.calls.at(-1)?.[0]

  it('renders a host placeholder for the managed native view', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive {...defaultProps} />)
    const host = container.querySelector('[data-ai-view-host]')
    expect(host).toBeInTheDocument()
    expect(host).toHaveClass('h-full')
    expect(host).toHaveClass('w-full')
  })

  it('addresses the main-process view by tab id and model, never by partition', () => {
    render(<AiSession tab={defaultTab} isActive {...defaultProps} />)

    const options = lastOptions() as {
      viewId: string
      source: { kind: string; modelId: string }
      isHostOwner: boolean
      revealAfterFirstLoad: boolean
    }
    expect(options.viewId).toBe(defaultTab.id)
    expect(options.source).toEqual({ kind: 'ai-platform', modelId: 'gpt-4' })
    expect(options.isHostOwner).toBe(true)
    expect(options.revealAfterFirstLoad).toBe(true)
  })

  it('does not re-target the managed view when the cached navigation URL changes', () => {
    const { rerender } = render(<AiSession tab={defaultTab} isActive {...defaultProps} />)
    const firstOptions = lastOptions()

    rerender(
      <AiSession
        tab={defaultTab}
        isActive
        restoredUrl="https://chat.openai.com/c/existing-chat"
        {...defaultProps}
      />
    )

    const secondOptions = lastOptions() as { viewId: string; source: unknown }
    expect(secondOptions.viewId).toBe(firstOptions.viewId)
    expect(secondOptions.source).toEqual(firstOptions.source)
  })

  it('hides when inactive', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive={false} {...defaultProps} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ visibility: 'hidden' })
    expect((lastOptions() as { visible: boolean }).visible).toBe(false)
  })

  it('never owns the host while another surface is active', () => {
    render(<AiSession tab={defaultTab} isActive {...defaultProps} isSurfaceActive={false} />)
    expect((lastOptions() as { isHostOwner: boolean }).isHostOwner).toBe(false)
  })

  it('treats an overlay (home / tutorial) as hidden', () => {
    render(<AiSession tab={defaultTab} isActive {...defaultProps} isOverlayActive />)
    expect((lastOptions() as { visible: boolean }).visible).toBe(false)
  })

  it('keeps host ownership while inactive so it can still hide its view', () => {
    // Regression guard: ownership used to be gated on `isActive`, which meant
    // that showing AI Home left nobody able to publish `visible: false`. The
    // native view then kept its last rectangle and stayed painted over the home
    // screen, offset from the panel it belonged to.
    const { rerender } = render(<AiSession tab={defaultTab} isActive {...defaultProps} />)
    expect((lastOptions() as { isHostOwner: boolean }).isHostOwner).toBe(true)

    rerender(<AiSession tab={defaultTab} isActive={false} {...defaultProps} />)

    const options = lastOptions() as { isHostOwner: boolean; visible: boolean }
    expect(options.isHostOwner).toBe(true)
    expect(options.visible).toBe(false)
  })

  it('shows loader when loading', () => {
    render(
      <AiSession tab={{ ...defaultTab, modelId: 'loading-model' }} isActive {...defaultProps} />
    )
    expect(screen.getByTestId('aesthetic-loader')).toBeInTheDocument()
  })

  it('shows error view when error occurs', async () => {
    render(<AiSession tab={{ ...defaultTab, modelId: 'error-model' }} isActive {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('ai-error-view')).toBeInTheDocument()
    })
    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument()
  })

  it('renders no mouse shield, which cannot cover a native view anyway', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive {...defaultProps} />)
    expect(container.querySelector('.pointer-events-auto')).not.toBeInTheDocument()
  })
})
