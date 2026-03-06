import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelsPanel } from '@ui/layout/BottomBar/ModelsPanel'

const mockSetEnabledModels = vi.fn()
const mockAddTab = vi.fn()

vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    Reorder: {
        Group: ({ children, onReorder, values, ...props }: any) => <div {...props}>{children}</div>
    }
}))

vi.mock('@app/providers', () => ({
    useAi: () => ({
        addTab: mockAddTab,
        enabledModels: ['chatgpt', 'gemini', 'youtube'],
        setEnabledModels: mockSetEnabledModels,
        aiSites: {
            chatgpt: { icon: 'chatgpt', displayName: 'ChatGPT' },
            gemini: { icon: 'gemini', displayName: 'Gemini' },
            youtube: { icon: 'youtube', displayName: 'YouTube' }
        }
    }),
    useLanguage: () => ({
        t: (key: string) => key
    })
}))

vi.mock('@ui/layout/BottomBar/AIItem', () => ({
    AIItem: ({ modelKey }: { modelKey: string }) => <div>{modelKey}</div>
}))

vi.mock('@ui/layout/BottomBar/animations', () => ({
    panelVariantsVertical: {},
    panelTransition: {}
}))

describe('ModelsPanel', () => {
    beforeEach(() => {
        mockAddTab.mockReset()
        mockSetEnabledModels.mockReset()
    })

    it('renders a bounded scroll area instead of growing with the list', () => {
        render(
            <ModelsPanel
                isOpen
                panelStyle={{}}
                showOnlyIcons
            />
        )

        const scrollArea = screen.getByTestId('models-panel-scroll-area')
        expect(scrollArea).toHaveClass('overflow-y-auto')
        expect(scrollArea).toHaveClass('scrollbar-hidden')
        expect(scrollArea).toHaveStyle({ maxHeight: 'min(52vh, 24rem)' })
    })
})
