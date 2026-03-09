import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiModelList } from '@features/settings/ui/models/AiModelList'
import type { AiPlatform } from '@shared-core/types'

vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, layout: _layout, ...props }: any) => <div {...props}>{children}</div>
    }
}))

vi.mock('@headlessui/react', () => ({
    Field: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
    Description: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    Switch: ({ checked, onChange, disabled, ...props }: any) => (
        <button
            type="button"
            aria-pressed={checked}
            disabled={disabled}
            onClick={() => onChange?.(!checked)}
            {...props}
        />
    )
}))

vi.mock('@ui/components/Icons', () => ({
    GridIcon: ({ className }: { className?: string }) => <span className={className}>GridIcon</span>,
    TrashIcon: ({ className }: { className?: string }) => <span className={className}>TrashIcon</span>,
    getAiIcon: vi.fn((icon: string) => icon === 'chatgpt' ? <span>ChatGptIcon</span> : null)
}))

describe('AiModelList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function createProps(overrides: Partial<React.ComponentProps<typeof AiModelList>> = {}) {
        const aiSites: Record<string, AiPlatform> = {
            chatgpt: {
                id: 'chatgpt',
                icon: 'chatgpt',
                displayName: 'ChatGPT',
                name: 'ChatGPT',
                url: 'https://chatgpt.com',
                isCustom: false,
                isSite: false
            },
            'custom-model': {
                id: 'custom-model',
                icon: 'unknown',
                displayName: 'Custom Display',
                name: 'Custom Name',
                url: 'https://custom.example',
                isCustom: true,
                isSite: false
            }
        }

        return {
            modelsList: ['chatgpt', 'custom-model'],
            enabledModels: ['chatgpt'],
            aiSites,
            toggleModel: vi.fn(),
            handleDeleteAi: vi.fn(() => Promise.resolve()),
            isDeleting: false,
            minEnabledModels: 1,
            defaultAiModel: 'chatgpt',
            setDefaultAiModel: vi.fn(),
            t: (key: string) => {
                const translations: Record<string, string> = {
                    chatgpt: 'ChatGPT Translated',
                    model_active: 'Active',
                    model_inactive: 'Inactive',
                    custom_badge: 'Custom',
                    is_default_model: 'Default model',
                    set_as_default: 'Set default',
                    delete_custom_ai: 'Delete custom AI'
                }
                return translations[key] ?? key
            },
            ...overrides
        }
    }

    it('prefers translated labels and falls back to displayName when untranslated', () => {
        const props = createProps()

        render(<AiModelList {...props} />)

        expect(screen.getByText('ChatGPT Translated')).toBeInTheDocument()
        expect(screen.getByText('Custom Display')).toBeInTheDocument()
        expect(screen.getByText('ChatGptIcon')).toBeInTheDocument()
        expect(screen.getByText('GridIcon')).toBeInTheDocument()
    })

    it('sets the default model without toggling the row', () => {
        const props = createProps()

        render(<AiModelList {...props} />)

        fireEvent.click(screen.getByTitle('Default model'))

        expect(props.setDefaultAiModel).toHaveBeenCalledWith('chatgpt')
        expect(props.toggleModel).not.toHaveBeenCalled()
    })

    it('clears local deleting state after a failed delete attempt', async () => {
        const handleDeleteAi = vi.fn(() => Promise.reject(new Error('delete failed')))
        const props = createProps({ handleDeleteAi })

        render(<AiModelList {...props} />)

        fireEvent.click(screen.getByTitle('Delete custom AI'))

        await waitFor(() => {
            expect(screen.getByText('TrashIcon')).toBeInTheDocument()
        })

        expect(handleDeleteAi).toHaveBeenCalledWith(expect.any(Object), 'custom-model', 'Custom Name')
    })
})
