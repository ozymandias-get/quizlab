import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectorsTab from '@features/settings/ui/SelectorsTab'
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

const {
    aiSites,
    mockConfirm,
    mockDeleteConfig,
    mockLoggerError,
    mockStartTutorial,
    selectorsData
} = vi.hoisted(() => ({
    aiSites: {
        chatgpt: {
            id: 'chatgpt',
            icon: 'chatgpt',
            displayName: 'ChatGPT',
            name: 'ChatGPT',
            url: 'https://chat.openai.com',
            isSite: false
        },
        'custom-ai': {
            id: 'custom-ai',
            displayName: 'Custom AI',
            name: 'Custom AI',
            url: 'https://custom.example',
            isSite: false
        },
        website: {
            id: 'website',
            displayName: 'Example Site',
            name: 'Example Site',
            url: 'https://example.com',
            isSite: true
        }
    } satisfies Record<string, AiPlatform>,
    mockConfirm: vi.fn(() => true),
    mockDeleteConfig: vi.fn(),
    mockLoggerError: vi.fn(),
    mockStartTutorial: vi.fn(),
    selectorsData: {
        'openai.com': { input: '#prompt' }
    } satisfies Record<string, AiSelectorConfig>
}))

vi.mock('@app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

vi.mock('@app/providers/AiContext', () => ({
    useAiState: () => ({ aiSites }),
    useAiActions: () => ({ startTutorial: mockStartTutorial })
}))

vi.mock('@platform/electron/api/useAiApi', () => ({
    useAiConfig: () => ({ data: selectorsData }),
    useDeleteAiConfig: () => ({ mutateAsync: mockDeleteConfig, isPending: false })
}))

vi.mock('@shared/lib/logger', () => ({
    Logger: {
        error: mockLoggerError
    }
}))

vi.mock('@ui/components/Icons', () => ({
    CheckIcon: ({ className }: { className?: string }) => <span className={className}>CheckIcon</span>,
    ChevronRightIcon: ({ className }: { className?: string }) => <span className={className}>ChevronRightIcon</span>,
    GlobeIcon: ({ className }: { className?: string }) => <span className={className}>GlobeIcon</span>,
    MagicWandIcon: ({ className }: { className?: string }) => <span className={className}>MagicWandIcon</span>,
    SelectorIcon: ({ className }: { className?: string }) => <span className={className}>SelectorIcon</span>,
    TrashIcon: ({ className }: { className?: string }) => <span className={className}>TrashIcon</span>,
    getAiIcon: vi.fn((icon: string) => icon === 'chatgpt' ? <span>ChatGptIcon</span> : null)
}))

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, layout: _layout, ...props }: any) => <div {...props}>{children}</div>
    }
}))

describe('SelectorsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('confirm', mockConfirm)
        mockDeleteConfig.mockResolvedValue(true)
    })

    it('starts the tutorial and closes settings from the CTA card', () => {
        const onCloseSettings = vi.fn()

        render(<SelectorsTab onCloseSettings={onCloseSettings} />)

        fireEvent.click(screen.getByText('tutorial_button_title'))

        expect(mockStartTutorial).toHaveBeenCalledTimes(1)
        expect(onCloseSettings).toHaveBeenCalledTimes(1)
    })

    it('shows selector status and deletes the matched selector host', async () => {
        render(<SelectorsTab />)

        expect(screen.getByText('ChatGPT')).toBeInTheDocument()
        expect(screen.getByText('Custom AI')).toBeInTheDocument()
        expect(screen.queryByText('Example Site')).not.toBeInTheDocument()
        expect(screen.getByText('selectors_active')).toBeInTheDocument()
        expect(screen.getByText('no_selectors')).toBeInTheDocument()
        expect(screen.getByText('ChatGptIcon')).toBeInTheDocument()
        expect(screen.getByText('GlobeIcon')).toBeInTheDocument()

        fireEvent.click(screen.getByTitle('delete_selectors'))

        await waitFor(() => {
            expect(mockDeleteConfig).toHaveBeenCalledWith('openai.com')
        })

        expect(mockConfirm).toHaveBeenCalledWith('confirm_delete_selectors')
    })
})
