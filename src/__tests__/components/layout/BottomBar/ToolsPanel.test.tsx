import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToolsPanel } from '@ui/layout/BottomBar/ToolsPanel'

const mockStartGeminiWebLogin = vi.fn()
const mockHandleSettingsClick = vi.fn()
const mockHandleGeminiWebSettingsClick = vi.fn()

const mockAppTools = {
    isPickerActive: false,
    togglePicker: vi.fn(),
    isGeminiWebLoginInProgress: false,
    startGeminiWebLogin: mockStartGeminiWebLogin
}

const mockGeminiWebStatus = vi.fn()

vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    }
}))

vi.mock('@app/providers', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                settings: 'Settings',
                swap_window: 'Swap panels',
                element_picker: 'Element picker',
                close_quiz: 'Close quiz',
                open_quiz: 'Open quiz',
                gws_toolbar_title: 'Google Session',
                gws_toolbar_authenticated: 'Google session ready',
                gws_toolbar_auth_required: 'Google session needs login',
                gws_toolbar_reauth_required: 'Google session needs reauth',
                gws_toolbar_degraded: 'Google session degraded',
                gws_toolbar_checking: 'Verifying Google session'
            }
            return translations[key] ?? key
        }
    }),
    useAppTools: () => mockAppTools
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
    useGeminiWebStatus: () => mockGeminiWebStatus()
}))

vi.mock('@ui/layout/BottomBar/ToolButton', () => ({
    ToolButton: ({ children, onClick, title }: any) => (
        <button onClick={onClick} title={title}>
            {children}
        </button>
    )
}))

vi.mock('@ui/layout/BottomBar/animations', () => ({
    panelVariantsVertical: {},
    panelTransition: {},
    toolListVariants: {}
}))

describe('ToolsPanel', () => {
    beforeEach(() => {
        mockStartGeminiWebLogin.mockReset()
        mockHandleSettingsClick.mockReset()
        mockHandleGeminiWebSettingsClick.mockReset()
        mockAppTools.isGeminiWebLoginInProgress = false
        mockGeminiWebStatus.mockReturnValue({
            data: {
                featureEnabled: true,
                enabled: true,
                state: 'authenticated'
            },
            isLoading: false
        })
    })

    it('renders the Gemini session button above settings when web session is enabled', () => {
        render(
            <ToolsPanel
                isOpen
                panelStyle={{}}
                handleSettingsClick={mockHandleSettingsClick}
                handleGeminiWebSettingsClick={mockHandleGeminiWebSettingsClick}
                toggleLayoutSwap={vi.fn()}
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        const buttons = screen.getAllByRole('button')
        expect(buttons[0]).toHaveAttribute('title', 'Google Session - Google session ready')
        expect(buttons[1]).toHaveAttribute('title', 'Settings')
    })

    it('starts Playwright login when the Gemini session button requires authentication', () => {
        mockGeminiWebStatus.mockReturnValue({
            data: {
                featureEnabled: true,
                enabled: true,
                state: 'auth_required'
            },
            isLoading: false
        })

        render(
            <ToolsPanel
                isOpen
                panelStyle={{}}
                handleSettingsClick={mockHandleSettingsClick}
                handleGeminiWebSettingsClick={mockHandleGeminiWebSettingsClick}
                toggleLayoutSwap={vi.fn()}
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        fireEvent.click(screen.getByTitle('Google Session - Google session needs login'))

        expect(mockStartGeminiWebLogin).toHaveBeenCalledTimes(1)
        expect(mockHandleSettingsClick).not.toHaveBeenCalled()
    })

    it('opens settings when the Gemini session button is healthy', () => {
        render(
            <ToolsPanel
                isOpen
                panelStyle={{}}
                handleSettingsClick={mockHandleSettingsClick}
                handleGeminiWebSettingsClick={mockHandleGeminiWebSettingsClick}
                toggleLayoutSwap={vi.fn()}
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        fireEvent.click(screen.getByTitle('Google Session - Google session ready'))

        expect(mockHandleGeminiWebSettingsClick).toHaveBeenCalledTimes(1)
        expect(mockHandleSettingsClick).not.toHaveBeenCalled()
        expect(mockStartGeminiWebLogin).not.toHaveBeenCalled()
    })
})
