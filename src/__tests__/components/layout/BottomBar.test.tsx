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
  useLanguage: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@app/providers/AiContext', () => ({
  useAiState: () => ({
    tabs: []
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
  ToolsPanel: ({ isOpen, maxHeight, handleSettingsClick, handleGeminiWebSettingsClick }: any) => (
    <div data-testid="tools-panel" data-max-height={maxHeight ?? ''}>
      {isOpen ? 'Tools Open' : 'Tools Closed'}
      <div
        data-testid="tools-panel-scroll-area"
        ref={(element) => {
          if (!element) return

          Object.defineProperty(element, 'scrollHeight', {
            configurable: true,
            value: 120
          })
        }}
      >
        <div style={{ height: '120px' }} />
      </div>
      <button onClick={handleSettingsClick}>Settings</button>
      <button onClick={handleGeminiWebSettingsClick}>Gemini Web Settings</button>
    </div>
  )
}))

vi.mock('@ui/layout/BottomBar/ModelsPanel', () => ({
  ModelsPanel: ({ maxHeight }: any) => (
    <div data-testid="models-panel" data-max-height={maxHeight ?? ''}>
      <div
        data-testid="models-panel-scroll-area"
        ref={(element) => {
          if (!element) return

          Object.defineProperty(element, 'scrollHeight', {
            configurable: true,
            value: 280
          })
        }}
      >
        <div style={{ height: '280px' }} />
      </div>
      Models Panel
    </div>
  )
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
  default: ({ isOpen, onClose, initialTab }: any) =>
    isOpen ? (
      <div data-testid="settings-modal">
        Settings Modal Content
        <span>{initialTab}</span>
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
    const {
      whileHover,
      whileTap,
      initial,
      animate,
      exit,
      transition,
      variants,
      custom,
      mode,
      layout,
      ...rest
    } = props
    return rest
  }

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterProps(props)}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...filterProps(props)}>{children}</button>,
      span: ({ children, ...props }: any) => <span {...filterProps(props)}>{children}</span>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
  }
})

describe('BottomBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders closed state initially', () => {
    const { container } = render(<BottomBar />)

    expect(screen.getByTestId('tools-panel')).toHaveTextContent('Tools Closed')
    expect(screen.getByTestId('models-panel')).toBeInTheDocument()

    // Find CenterHub via ID
    const hubBtn = container.querySelector(`#${APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}`)
    expect(hubBtn).toBeInTheDocument()
  })

  it('toggles open state when clicking center hub', () => {
    const { container } = render(<BottomBar />)

    const hubBtn = container.querySelector(`#${APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}`)
    expect(hubBtn).toBeInTheDocument()

    if (hubBtn) {
      fireEvent.pointerDown(hubBtn, { clientX: 0, clientY: 0 })
      fireEvent.pointerUp(hubBtn, { clientX: 0, clientY: 0 })
    }

    expect(screen.getByTestId('tools-panel')).toHaveTextContent('Tools Open')
  })

  it('opens settings modal', async () => {
    render(<BottomBar />)

    const settingsTrigger = screen.getByText('Settings')
    fireEvent.click(settingsTrigger)

    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument()
  })

  it('closes settings modal', async () => {
    render(<BottomBar />)

    fireEvent.click(screen.getByText('Settings'))
    const closeBtn = await screen.findByText('Close Modal')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument()
    })
  })

  it('opens Gemini web settings tab from the Gemini session button', async () => {
    render(<BottomBar />)

    fireEvent.click(screen.getByText('Gemini Web Settings'))

    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument()
    expect(screen.getByText('gemini-web')).toBeInTheDocument()
  })

  it('keeps the top and bottom panels at the same visible height using the shorter content height', async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('resizer-hub-container')) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 56,
            bottom: 600,
            width: 56,
            height: 600,
            toJSON: () => ({})
          } as DOMRect
        }

        if (this.classList.contains('hub-center-btn')) {
          return {
            x: 0,
            y: 200,
            top: 200,
            left: 0,
            right: 56,
            bottom: 248,
            width: 56,
            height: 48,
            toJSON: () => ({})
          } as DOMRect
        }

        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({})
        } as DOMRect
      })

    try {
      const { container } = render(<BottomBar />)

      const hubBtn = container.querySelector(`#${APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}`)
      expect(hubBtn).toBeInTheDocument()

      if (hubBtn) {
        fireEvent.pointerDown(hubBtn, { clientX: 0, clientY: 0 })
        fireEvent.pointerUp(hubBtn, { clientX: 0, clientY: 0 })
      }

      await waitFor(() => {
        expect(screen.getByTestId('tools-panel')).toHaveAttribute('data-max-height', '120')
        expect(screen.getByTestId('models-panel')).toHaveAttribute('data-max-height', '120')
      })
    } finally {
      rectSpy.mockRestore()
    }
  })
})
