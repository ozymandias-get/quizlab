import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiSession from '@features/ai/components/AiSession'

// Mock Hooks
vi.mock('@src/app/providers', () => ({
    useAi: () => ({
        aiSites: {
            'gpt-4': { url: 'https://chat.openai.com', displayName: 'ChatGPT' },
            'claude-3': { url: 'https://claude.ai', displayName: 'Claude' }
        },
        registerWebview: vi.fn(),
        chromeUserAgent: 'mock-user-agent'
    }),
    useToast: () => ({ showWarning: vi.fn() }),
    useLanguage: () => ({ t: (key: string) => key })
}))

vi.mock('@src/hooks/webview/useWebviewLifecycle', () => ({
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

// Mock Components
vi.mock('@src/components/ui/AestheticLoader', () => ({
    default: () => <div data-testid="aesthetic-loader">Loading...</div>
}))

vi.mock('@features/ai/components/AiErrorView', () => ({
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
        // Check if webview tag is rendered
        // Since JSDOM doesn't support webview, render will produce <webview> element but without shadow DOM.
        // We can check by tag name.
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
            <AiSession tab={{ ...defaultTab, modelId: 'loading-model' }} isActive={true} isBarHovered={false} />
        )
        expect(screen.getByTestId('aesthetic-loader')).toBeInTheDocument()
    })

    it('shows error view when error occurs', () => {
        render(
            <AiSession tab={{ ...defaultTab, modelId: 'error-model' }} isActive={true} isBarHovered={false} />
        )
        expect(screen.getByTestId('ai-error-view')).toBeInTheDocument()
        expect(screen.getByText('Error: Failed to load')).toBeInTheDocument()
    })

    it('renders mouse catcher when bar is hovered', () => {
        const { container } = render(
            <AiSession tab={defaultTab} isActive={true} isBarHovered={true} />
        )
        // The mouse catcher is absolute inset-0 z-[5] bg-transparent
        // Hard to distinguish from other divs exactly without test-id or class.
        // But we know structure: wrapper -> flex-1 relative -> ... -> mouse catcher
        // Let's assume implementation details or add data-testid if needed.
        // Or check count of children.

        // Let's look for the one with pointer-events-auto
        // But 'pointer-events-auto' is class name.
        // We can query selector.
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
