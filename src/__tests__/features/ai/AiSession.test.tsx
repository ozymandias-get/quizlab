import AiSession from '@features/ai/ui/AiSession'

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@app/providers/AiContext', () => ({
  useAiRegistryMeta: () => ({
    isRegistryLoaded: true,
    chromeUserAgent: 'mock-user-agent'
  }),
  useAiSites: () => ({
    'gpt-4': { url: 'https://chat.openai.com', displayName: 'ChatGPT' },
    'claude-3': { url: 'https://claude.ai', displayName: 'Claude' }
  }),
  useAiModelsCatalog: () => ({
    aiSites: {
      'gpt-4': { url: 'https://chat.openai.com', displayName: 'ChatGPT' },
      'claude-3': { url: 'https://claude.ai', displayName: 'Claude' }
    },
    enabledModels: [],
    defaultAiModel: 'gpt-4'
  }),
  useAiWebviewHostActions: () => ({
    registerWebview: vi.fn()
  })
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showWarning: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@shared/hooks/webview/useWebviewLifecycle', () => ({
  useWebviewLifecycle: ({ currentAI }: any) => {
    const base = {
      onWebviewRef: vi.fn(),
      handleRetry: vi.fn(),
      openDevTools: vi.fn()
    }
    if (currentAI === 'error-model') {
      return { ...base, isLoading: false, error: new Error('Failed to load') }
    }
    if (currentAI === 'loading-model') {
      return { ...base, isLoading: true, error: null }
    }
    return { ...base, isLoading: false, error: null }
  }
}))

vi.mock('@ui/components/AestheticLoader', () => ({
  default: () => <div data-testid="aesthetic-loader">Loading...</div>
}))

vi.mock('@features/ai/ui/AiErrorView', () => ({
  default: ({ error, onRetry }: any) => (
    <div data-testid="ai-error-view">
      Error: {error.message}
      <button onClick={onRetry}>Retry</button>
    </div>
  )
}))

describe('AiSession', () => {
  const defaultTab = { id: '1', modelId: 'gpt-4', title: 'GPT-4' }

  it('renders webview when active', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive isBarHovered={false} />)
    const webview = container.querySelector('webview')
    expect(webview).toBeInTheDocument()
    expect(webview).toHaveAttribute('src', 'https://chat.openai.com')
    expect(webview).toHaveAttribute('useragent', 'mock-user-agent')
  })

  it('does not rewrite the mounted webview src when the cached navigation URL changes', () => {
    const { container, rerender } = render(
      <AiSession tab={defaultTab} isActive isBarHovered={false} />
    )
    const webview = container.querySelector('webview')

    rerender(
      <AiSession
        tab={defaultTab}
        isActive
        isBarHovered
        restoredUrl="https://chat.openai.com/c/existing-chat"
      />
    )

    expect(container.querySelector('webview')).toBe(webview)
    expect(webview).toHaveAttribute('src', 'https://chat.openai.com')
  })

  it('hides when inactive', () => {
    const { container } = render(
      <AiSession tab={defaultTab} isActive={false} isBarHovered={false} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ visibility: 'hidden' })
  })

  it('shows loader when loading', () => {
    render(
      <AiSession tab={{ ...defaultTab, modelId: 'loading-model' }} isActive isBarHovered={false} />
    )
    expect(screen.getByTestId('aesthetic-loader')).toBeInTheDocument()
  })

  it('shows error view when error occurs', async () => {
    render(
      <AiSession tab={{ ...defaultTab, modelId: 'error-model' }} isActive isBarHovered={false} />
    )
    await waitFor(() => {
      expect(screen.getByTestId('ai-error-view')).toBeInTheDocument()
    })
    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument()
  })

  it('renders mouse catcher when bar is hovered', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive isBarHovered />)
    const catcher = container.querySelector('.pointer-events-auto')
    expect(catcher).toBeInTheDocument()
  })

  it('does not render mouse catcher when not hovered', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive isBarHovered={false} />)
    const catcher = container.querySelector('.pointer-events-auto')
    expect(catcher).not.toBeInTheDocument()
  })
})
