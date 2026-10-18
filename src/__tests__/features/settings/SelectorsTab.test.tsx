import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

import SelectorsTab from '@features/settings/ui/SelectorsTab'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The harness is only ever reached lazily from the `vi.mock` factories below, so
// it is never imported statically.
const {
  mockConfirm,
  mockDeleteConfig,
  mockGenerateValidateSelectorsScript,
  mockOpenAiWorkspace,
  mockSaveAiConfig,
  mockShowSuccess,
  mockStartPickerWhenReady,
  mockContent,
  stubs
} = vi.hoisted(() => {
  const aiSites = {
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
  } satisfies Record<string, AiPlatform>

  const selectorsData = {
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

  const mockContent = { executeJavaScript: vi.fn() }
  const mocks = {
    openAiWorkspace: vi.fn(),
    startPickerWhenReady: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
    logError: vi.fn(),
    saveAiConfig: vi.fn(),
    deleteConfig: vi.fn(),
    generateValidateSelectorsScript: vi.fn()
  }

  return {
    mockConfirm: vi.fn(() => true),
    mockContent,
    mockDeleteConfig: mocks.deleteConfig,
    mockGenerateValidateSelectorsScript: mocks.generateValidateSelectorsScript,
    mockOpenAiWorkspace: mocks.openAiWorkspace,
    mockSaveAiConfig: mocks.saveAiConfig,
    mockShowSuccess: mocks.showSuccess,
    mockStartPickerWhenReady: mocks.startPickerWhenReady,
    // The harness turns this one object into every module namespace, so a new
    // icon or query hook is a change in selectorsTabHarness.tsx only.
    stubs: {
      aiSites,
      aiConfig: selectorsData,
      mockContent,
      tabs: [{ id: 'tab-chatgpt', modelId: 'chatgpt' }],
      currentAI: 'chatgpt',
      getContentController: () => mockContent,
      hasActiveContent: true,
      ...mocks
    }
  }
})

// `vi.mock` calls are hoisted above every top-level binding, so each factory
// has to reach the harness lazily rather than through a shared helper.
vi.mock(
  '@ui/components/Icons',
  async () => (await import('./selectorsTabHarness')).selectorsTabIconStubs
)
vi.mock('motion/react', async () => (await import('./selectorsTabHarness')).selectorsTabMotionStubs)
vi.mock('react-i18next', async () =>
  (await import('./selectorsTabHarness')).selectorsTabI18nStubs()
)
vi.mock(
  '@app/providers',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)['@app/providers']
)
vi.mock(
  '@app/providers/ai-context',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@app/providers/ai-context'
    ]
)
vi.mock(
  '@platform/electron/api/useAiApi',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@platform/electron/api/useAiApi'
    ]
)
vi.mock(
  '@platform/electron/api/useSettingsAiApi',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@platform/electron/api/useSettingsAiApi'
    ]
)
vi.mock(
  '@platform/electron/api/useAutomationApi',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@platform/electron/api/useAutomationApi'
    ]
)
vi.mock(
  '@shared/lib/logger',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)['@shared/lib/logger']
)

describe('SelectorsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', mockConfirm)
    mockDeleteConfig.mockResolvedValue(true)
    mockSaveAiConfig.mockResolvedValue(true)
    mockGenerateValidateSelectorsScript.mockResolvedValue('// validate')
    mockContent.executeJavaScript.mockResolvedValue({
      success: true,
      diagnostics: {
        input: { strategy: 'direct', matchedSelector: '#prompt', requestedSelector: '#prompt' },
        button: { strategy: 'direct', matchedSelector: '#send', requestedSelector: '#send' }
      }
    })
  })

  it('renders advanced selector controls and validates the current tab', async () => {
    render(<SelectorsTab />)

    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))

    expect(screen.getByText('selectors_saved_host_label')).toBeInTheDocument()
    expect(screen.getByText('selectors_saved_host')).toBeInTheDocument()

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

    expect(mockContent.executeJavaScript).toHaveBeenCalledWith('// validate')
    expect(mockShowSuccess).toHaveBeenCalledWith('selectors_test_success', 'toast_automation_title')
    expect(screen.getAllByText('direct')).toHaveLength(2)
  })

  it('opens the requested AI tab for re-pick and can reset selectors', async () => {
    const onCloseSettings = vi.fn()
    render(<SelectorsTab onCloseSettings={onCloseSettings} />)

    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))
    fireEvent.click(
      screen.getAllByRole('button', { name: /selectors_open_repick/ })[0] as HTMLElement
    )

    expect(mockOpenAiWorkspace).toHaveBeenCalledWith('chatgpt')
    expect(mockStartPickerWhenReady).toHaveBeenCalledTimes(1)
    expect(onCloseSettings).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'delete_selectors' }))

    await waitFor(() => {
      expect(mockDeleteConfig).toHaveBeenCalledWith('openai.com')
    })

    expect(mockConfirm).toHaveBeenCalledWith('confirm_delete_selectors')
  })
})
