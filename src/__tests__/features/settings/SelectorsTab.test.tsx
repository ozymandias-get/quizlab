import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectorsTab from '@features/settings/ui/SelectorsTab'
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

const {
  aiSites,
  mockConfirm,
  mockDeleteConfig,
  mockGenerateValidateSelectorsScript,
  mockLoggerError,
  mockOpenAiWorkspace,
  mockSaveAiConfig,
  mockShowError,
  mockShowSuccess,
  mockShowWarning,
  mockStartPickerWhenReady,
  mockStartTutorial,
  mockWebview,
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
      url: 'https://chat.custom.example/app',
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
  mockGenerateValidateSelectorsScript: vi.fn(),
  mockLoggerError: vi.fn(),
  mockOpenAiWorkspace: vi.fn(),
  mockSaveAiConfig: vi.fn(),
  mockShowError: vi.fn(),
  mockShowSuccess: vi.fn(),
  mockShowWarning: vi.fn(),
  mockStartPickerWhenReady: vi.fn(),
  mockStartTutorial: vi.fn(),
  mockWebview: {
    executeJavaScript: vi.fn()
  },
  selectorsData: {
    'openai.com': {
      version: 2,
      input: '#prompt',
      button: '#send',
      inputCandidates: ['#prompt'],
      buttonCandidates: ['#send'],
      inputFingerprint: { tag: 'textarea' },
      buttonFingerprint: { tag: 'button' },
      sourceHostname: 'openai.com',
      canonicalHostname: 'openai.com',
      health: 'ready',
      submitMode: 'mixed'
    }
  } satisfies Record<string, AiSelectorConfig>
}))

vi.mock('@app/providers', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.host) {
        return `${key}:${params.host}`
      }
      return key
    }
  }),
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning
  }),
  useAppTools: () => ({
    startPickerWhenReady: mockStartPickerWhenReady
  })
}))

vi.mock('@app/providers/AiContext', () => ({
  useAiState: () => ({
    aiSites,
    tabs: [{ id: 'tab-chatgpt', modelId: 'chatgpt' }],
    currentAI: 'chatgpt',
    webviewInstance: mockWebview
  }),
  useAiActions: () => ({
    startTutorial: mockStartTutorial,
    openAiWorkspace: mockOpenAiWorkspace
  })
}))

vi.mock('@platform/electron/api/useAiApi', () => ({
  useAiConfig: () => ({ data: selectorsData }),
  useDeleteAiConfig: () => ({ mutateAsync: mockDeleteConfig, isPending: false }),
  useSaveAiConfig: () => ({ mutateAsync: mockSaveAiConfig, isPending: false })
}))

vi.mock('@platform/electron/api/useAutomationApi', () => ({
  useGenerateValidateSelectorsScript: () => ({
    mutateAsync: mockGenerateValidateSelectorsScript,
    isPending: false
  })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    error: mockLoggerError
  }
}))

vi.mock('@ui/components/Icons', () => ({
  CheckIcon: ({ className }: { className?: string }) => (
    <span className={className}>CheckIcon</span>
  ),
  ChevronRightIcon: ({ className }: { className?: string }) => (
    <span className={className}>ChevronRightIcon</span>
  ),
  ExternalLinkIcon: ({ className }: { className?: string }) => (
    <span className={className}>ExternalLinkIcon</span>
  ),
  GlobeIcon: ({ className }: { className?: string }) => (
    <span className={className}>GlobeIcon</span>
  ),
  LoaderIcon: ({ className }: { className?: string }) => (
    <span className={className}>LoaderIcon</span>
  ),
  MagicWandIcon: ({ className }: { className?: string }) => (
    <span className={className}>MagicWandIcon</span>
  ),
  RefreshIcon: ({ className }: { className?: string }) => (
    <span className={className}>RefreshIcon</span>
  ),
  SelectorIcon: ({ className }: { className?: string }) => (
    <span className={className}>SelectorIcon</span>
  ),
  TrashIcon: ({ className }: { className?: string }) => (
    <span className={className}>TrashIcon</span>
  ),
  getAiIcon: vi.fn((icon: string) => (icon === 'chatgpt' ? <span>ChatGptIcon</span> : null))
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
    mockSaveAiConfig.mockResolvedValue(true)
    mockGenerateValidateSelectorsScript.mockResolvedValue('// validate')
    mockWebview.executeJavaScript.mockResolvedValue({
      success: true,
      diagnostics: {
        input: { strategy: 'direct', matchedSelector: '#prompt', requestedSelector: '#prompt' },
        button: { strategy: 'direct', matchedSelector: '#send', requestedSelector: '#send' }
      }
    })
  })

  it('starts the tutorial and closes settings from the CTA card', () => {
    const onCloseSettings = vi.fn()

    render(<SelectorsTab onCloseSettings={onCloseSettings} />)

    fireEvent.click(screen.getByText('tutorial_button_title'))

    expect(mockStartTutorial).toHaveBeenCalledTimes(1)
    expect(onCloseSettings).toHaveBeenCalledTimes(1)
  })

  it('renders advanced selector controls and validates the current tab', async () => {
    render(<SelectorsTab />)

    fireEvent.click(screen.getByRole('button', { name: /ChatGPT/i }))

    expect(screen.getByText('selectors_saved_host_label')).toBeInTheDocument()
    expect(screen.getByText('selectors_saved_host:openai.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'selectors_submit_mode_enter_key' }))

    await waitFor(() => {
      expect(mockSaveAiConfig).toHaveBeenCalledWith({
        hostname: 'openai.com',
        config: {
          version: 2,
          submitMode: 'enter_key'
        }
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /selectors_test_current_tab/ }))

    await waitFor(() => {
      expect(mockGenerateValidateSelectorsScript).toHaveBeenCalledWith(
        expect.objectContaining({
          input: '#prompt',
          button: '#send'
        })
      )
    })

    expect(mockWebview.executeJavaScript).toHaveBeenCalledWith('// validate')
    expect(mockShowSuccess).toHaveBeenCalledWith('selectors_test_success', 'toast_automation_title')
    expect(screen.getAllByText('direct')).toHaveLength(2)
  })

  it('opens the requested AI tab for re-pick and can reset selectors', async () => {
    const onCloseSettings = vi.fn()
    render(<SelectorsTab onCloseSettings={onCloseSettings} />)

    fireEvent.click(screen.getByRole('button', { name: /ChatGPT/i }))
    fireEvent.click(
      screen.getAllByRole('button', { name: /selectors_open_repick/ })[0] as HTMLElement
    )

    expect(mockOpenAiWorkspace).toHaveBeenCalledWith('chatgpt')
    expect(mockStartPickerWhenReady).toHaveBeenCalledTimes(1)
    expect(onCloseSettings).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTitle('delete_selectors'))

    await waitFor(() => {
      expect(mockDeleteConfig).toHaveBeenCalledWith('openai.com')
    })

    expect(mockConfirm).toHaveBeenCalledWith('confirm_delete_selectors')
  })
})
