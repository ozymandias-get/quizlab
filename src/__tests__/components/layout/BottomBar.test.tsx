import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BottomBar from '@ui/layout/BottomBar/index'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

// Mock dependencies
vi.mock('@app/providers', () => ({
    useAppearance: () => ({
        bottomBarOpacity: 1,
        bottomBarScale: 1,
        showOnlyIcons: false,
        toggleLayoutSwap: vi.fn(),
        isTourActive: false
    }),
    useAi: () => ({
        tabs: [],
        enabledModels: [],
        setEnabledModels: vi.fn(),
        defaultAiModel: 'chatgpt',
        setDefaultAiModel: vi.fn(),
        aiSites: {}
    }),
    useLanguage: () => ({
        t: (key: string) => key
    })
}))

vi.mock('@ui/layout/BottomBar/useBottomBarStyles', () => ({
    useBottomBarStyles: () => ({
        shellStyle: {},
        stackStyle: {},
        panelStyle: {},
        hubStyle: {}
    })
}))

// Mock subcomponents
vi.mock('@ui/layout/BottomBar/ToolsPanel', () => ({
    ToolsPanel: ({ isOpen, handleSettingsClick }: any) => (
        <div data-testid="tools-panel">
            {isOpen ? 'Tools Open' : 'Tools Closed'}
            <button onClick={handleSettingsClick}>Settings</button>
        </div>
    )
}))

vi.mock('@ui/layout/BottomBar/ModelsPanel', () => ({
    ModelsPanel: () => <div data-testid="models-panel">Models Panel</div>
}))

vi.mock('@ui/layout/BottomBar/SettingsLoadingSpinner', () => ({
    SettingsLoadingSpinner: () => <div>Loading...</div>
}))

vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom')
    return {
        ...actual,
        createPortal: (node: any) => node
    }
})

vi.mock('@features/settings/ui/SettingsModal', () => ({
    default: ({ isOpen, onClose }: any) => isOpen ? (
        <div data-testid="settings-modal">
            Settings Modal Content
            <button onClick={onClose}>Close Modal</button>
        </div>
    ) : null
}))

vi.mock('@ui/components/Icons', () => ({
    AiHubIcon: (props: any) => <svg {...props} data-testid="ai-hub" />,
    MagicWandIcon: (props: any) => <svg {...props} data-testid="magic-wand" />
}))

vi.mock('framer-motion', () => {
    const filterProps = (props: any) => {
        const { whileHover, whileTap, initial, animate, exit, transition, variants, custom, mode, layout, ...rest } = props
        return rest
    }

    return {
        motion: {
            div: ({ children, ...props }: any) => <div {...filterProps(props)}>{children}</div>,
            button: ({ children, ...props }: any) => <button {...filterProps(props)}>{children}</button>,
            span: ({ children, ...props }: any) => <span {...filterProps(props)}>{children}</span>,
        },
        AnimatePresence: ({ children }: any) => <>{children}</>,
    }
})

describe('BottomBar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders closed state initially', () => {
        const { container } = render(
            <BottomBar
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        expect(screen.getByTestId('tools-panel')).toHaveTextContent('Tools Closed')
        expect(screen.getByTestId('models-panel')).toBeInTheDocument()

        // Find CenterHub via ID
        const hubBtn = container.querySelector(`#${APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}`)
        expect(hubBtn).toBeInTheDocument()
    })

    it('toggles open state when clicking center hub', () => {
        const { container } = render(
            <BottomBar
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        const hubBtn = container.querySelector(`#${APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}`)
        expect(hubBtn).toBeInTheDocument()

        if (hubBtn) {
            fireEvent.pointerDown(hubBtn, { clientX: 0, clientY: 0 })
            fireEvent.pointerUp(hubBtn, { clientX: 0, clientY: 0 })
        }

        expect(screen.getByTestId('tools-panel')).toHaveTextContent('Tools Open')
    })

    it('opens settings modal', async () => {
        render(
            <BottomBar
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        const settingsTrigger = screen.getByText('Settings')
        fireEvent.click(settingsTrigger)

        expect(await screen.findByTestId('settings-modal')).toBeInTheDocument()
    })

    it('closes settings modal', async () => {
        render(
            <BottomBar
                isQuizMode={false}
                onToggleQuizMode={vi.fn()}
            />
        )

        fireEvent.click(screen.getByText('Settings'))
        const closeBtn = await screen.findByText('Close Modal')
        fireEvent.click(closeBtn)

        await waitFor(() => {
            expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument()
        })
    })
})



