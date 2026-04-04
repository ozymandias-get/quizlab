import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

vi.mock('@app/providers', () => {
  const t = (key: string) => {
    const translations: Record<string, string> = {
      settings: 'Settings',
      swap_window: 'Swap panels',
      element_picker: 'Element picker',
      gws_toolbar_title: 'Google Session',
      gws_toolbar_authenticated: 'Google session ready',
      gws_toolbar_auth_required: 'Google session needs login',
      gws_toolbar_reauth_required: 'Google session needs reauth',
      gws_toolbar_degraded: 'Google session degraded',
      gws_toolbar_checking: 'Verifying Google session'
    }
    return translations[key] ?? key
  }
  return {
    useLanguage: () => ({ t }),
    useLanguageStrings: () => ({ t, language: 'en' }),
    useAppToolFlagsState: () => ({
      isPickerActive: mockAppTools.isPickerActive,
      isGeminiWebLoginInProgress: mockAppTools.isGeminiWebLoginInProgress
    }),
    useAppToolActions: () => ({
      togglePicker: mockAppTools.togglePicker,
      startGeminiWebLogin: mockAppTools.startGeminiWebLogin
    })
  }
})

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

  it('renders the Gemini session button together with settings when web session is enabled', () => {
    render(
      <ToolsPanel
        isOpen
        panelStyle={{}}
        handleSettingsClick={mockHandleSettingsClick}
        handleGeminiWebSettingsClick={mockHandleGeminiWebSettingsClick}
        toggleLayoutSwap={vi.fn()}
      />
    )

    const buttonTitles = screen.getAllByRole('button').map((button) => button.getAttribute('title'))
    expect(buttonTitles).toContain('Google Session - Google session ready')
    expect(buttonTitles).toContain('Settings')
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
      />
    )

    fireEvent.click(screen.getByTitle('Google Session - Google session ready'))

    expect(mockHandleGeminiWebSettingsClick).toHaveBeenCalledTimes(1)
    expect(mockHandleSettingsClick).not.toHaveBeenCalled()
    expect(mockStartGeminiWebLogin).not.toHaveBeenCalled()
  })

  it('shows a bottom scroll cue when more content is available below', async () => {
    render(
      <ToolsPanel
        isOpen
        panelStyle={{}}
        maxHeight={100}
        handleSettingsClick={mockHandleSettingsClick}
        handleGeminiWebSettingsClick={mockHandleGeminiWebSettingsClick}
        toggleLayoutSwap={vi.fn()}
      />
    )

    const scrollArea = screen.getByTestId('tools-panel-scroll-area')

    Object.defineProperty(scrollArea, 'clientHeight', {
      configurable: true,
      value: 100
    })
    Object.defineProperty(scrollArea, 'scrollHeight', {
      configurable: true,
      value: 220
    })
    Object.defineProperty(scrollArea, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0
    })

    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      expect(screen.getByTestId('tools-panel-scroll-cue')).toBeInTheDocument()
    })
  })
})
