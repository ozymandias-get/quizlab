import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiSession from '@features/ai/ui/AiSession'

vi.mock('@app/providers/AiContext', () => ({
  useAiRegistryMeta: () => ({
    isRegistryLoaded: true,
    chromeUserAgent: 'mock-user-agent'
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
  useToastActions: () => ({ showWarning: vi.fn() }),
  useLanguage: () => ({ t: (key: string) => key }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

vi.mock('@shared/hooks/webview/useWebviewLifecycle', () => ({
  useWebviewLifecycle: ({ currentAI }: any) => {
    if (currentAI === 'error-model') {
      return {
        isLoading: false,
        error: new Error('Failed to load'),
        onWebviewRef: vi.fn(),
        handleRetry: vi.fn()
      }
    }
    if (currentAI === 'loading-model') {
      return {
        isLoading: true,
        error: null,
        onWebviewRef: vi.fn(),
        handleRetry: vi.fn()
      }
    }
    return {
      isLoading: false,
      error: null,
      onWebviewRef: vi.fn(),
      handleRetry: vi.fn()
    }
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
    const { container } = render(
      <AiSession tab={defaultTab} isActive={true} isBarHovered={false} />
    )
    const webview = container.querySelector('webview')
    expect(webview).toBeInTheDocument()
    expect(webview).toHaveAttribute('src', 'https://chat.openai.com')
    expect(webview).toHaveAttribute('useragent', 'mock-user-agent')
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
      <AiSession
        tab={{ ...defaultTab, modelId: 'loading-model' }}
        isActive={true}
        isBarHovered={false}
      />
    )
    expect(screen.getByTestId('aesthetic-loader')).toBeInTheDocument()
  })

  it('shows error view when error occurs', () => {
    render(
      <AiSession
        tab={{ ...defaultTab, modelId: 'error-model' }}
        isActive={true}
        isBarHovered={false}
      />
    )
    expect(screen.getByTestId('ai-error-view')).toBeInTheDocument()
    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument()
  })

  it('renders mouse catcher when bar is hovered', () => {
    const { container } = render(<AiSession tab={defaultTab} isActive={true} isBarHovered={true} />)
    const catcher = container.querySelector('.pointer-events-auto')
    expect(catcher).toBeInTheDocument()
  })

  it('does not render mouse catcher when not hovered', () => {
    const { container } = render(
      <AiSession tab={defaultTab} isActive={true} isBarHovered={false} />
    )
    const catcher = container.querySelector('.pointer-events-auto')
    expect(catcher).not.toBeInTheDocument()
  })
})
