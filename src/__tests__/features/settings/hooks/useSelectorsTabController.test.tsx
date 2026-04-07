import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSelectorsTabController } from '@features/settings/ui/selectors/hooks/useSelectorsTabController'

const mocked = vi.hoisted(() => ({
  tabs: [{ key: 'gemini' }],
  currentAI: 'gemini',
  webviewInstance: { executeJavaScript: vi.fn() as any },
  aiSites: { gemini: { isSite: false, name: 'Gemini' } },
  startTutorial: vi.fn(),
  openAiWorkspace: vi.fn(),
  startPickerWhenReady: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  t: vi.fn((k: string) => k),
  deleteConfig: vi.fn().mockResolvedValue(undefined),
  saveAiConfig: vi.fn().mockResolvedValue(undefined),
  generateValidateSelectorsScript: vi.fn().mockResolvedValue('window.__test = true'),
  loggerError: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useAppToolActions: () => ({ startPickerWhenReady: mocked.startPickerWhenReady }),
  useLanguageStrings: () => ({ t: mocked.t }),
  useToastActions: () => ({
    showError: mocked.showError,
    showSuccess: mocked.showSuccess,
    showWarning: mocked.showWarning
  })
}))

vi.mock('@app/providers/AiContext', () => ({
  useAiCoreWorkspaceActions: () => ({
    startTutorial: mocked.startTutorial,
    openAiWorkspace: mocked.openAiWorkspace
  }),
  useAiModelsCatalog: () => ({ aiSites: mocked.aiSites }),
  useAiTabsSliceState: () => ({ tabs: mocked.tabs, currentAI: mocked.currentAI }),
  useAiWebview: () => ({ webviewInstance: mocked.webviewInstance })
}))

vi.mock('@platform/electron/api/useAiApi', () => ({
  useAiConfig: () => ({ data: { 'site.com': { submitMode: 'mixed', input: '#i', button: '#b' } } }),
  useDeleteAiConfig: () => ({ mutateAsync: mocked.deleteConfig, isPending: false }),
  useSaveAiConfig: () => ({ mutateAsync: mocked.saveAiConfig, isPending: false })
}))

vi.mock('@platform/electron/api/useAutomationApi', () => ({
  useGenerateValidateSelectorsScript: () => ({
    mutateAsync: mocked.generateValidateSelectorsScript,
    isPending: false
  })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: mocked.loggerError }
}))

describe('useSelectorsTabController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.currentAI = 'gemini'
    mocked.webviewInstance = { executeJavaScript: vi.fn().mockResolvedValue({ success: true }) }
    mocked.generateValidateSelectorsScript.mockResolvedValue('window.__test = true')
  })

  it('aborts delete when user does not confirm', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const { result } = renderHook(() => useSelectorsTabController({}))

    await act(async () => {
      await result.current.handleDeleteSelectors('site.com')
    })

    expect(mocked.deleteConfig).not.toHaveBeenCalled()
  })

  it('logs delete errors without throwing', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    mocked.deleteConfig.mockRejectedValueOnce(new Error('delete-failed'))
    const { result } = renderHook(() => useSelectorsTabController({}))

    await act(async () => {
      await result.current.handleDeleteSelectors('site.com')
    })

    expect(mocked.loggerError).toHaveBeenCalledWith(
      'Failed to delete selectors',
      expect.any(Error)
    )
  })

  it('normalizes invalid submit mode to mixed', async () => {
    const { result } = renderHook(() => useSelectorsTabController({}))

    await act(async () => {
      await result.current.handleSubmitModeChange('site.com', 'invalid' as never)
    })

    expect(mocked.saveAiConfig).toHaveBeenCalledWith({
      hostname: 'site.com',
      config: {
        version: 2,
        submitMode: 'mixed'
      }
    })
  })

  it('openRepick expands once and resets validation state', async () => {
    const { result } = renderHook(() => useSelectorsTabController({}))
    await act(async () => {
      result.current.handleOpenRepick('gemini', 'card-1')
      result.current.handleOpenRepick('gemini', 'card-1')
    })

    expect(result.current.expandedIds).toEqual(['card-1'])
    expect(result.current.validationState['card-1']).toEqual({ status: 'idle' })
  })

  it('shows warning when selector entry is missing', async () => {
    const { result } = renderHook(() => useSelectorsTabController({}))
    await act(async () => {
      await result.current.handleTestSelectors('gemini', null, 'card-a')
    })

    expect(mocked.showWarning).toHaveBeenCalledWith(
      'selectors_test_no_config',
      'toast_automation_title'
    )
  })

  it('shows warning when active tab or webview is invalid', async () => {
    mocked.currentAI = 'chatgpt'
    const { result } = renderHook(() => useSelectorsTabController({}))

    await act(async () => {
      await result.current.handleTestSelectors(
        'gemini',
        { hostname: 'site.com', config: { input: '#i', button: '#b', submitMode: 'mixed' } } as never,
        'card-b'
      )
    })

    expect(mocked.showWarning).toHaveBeenCalledWith(
      'selectors_test_requires_active_tab',
      'toast_automation_title'
    )
  })

  it('maps execution error key and preserves diagnostics', async () => {
    mocked.webviewInstance.executeJavaScript.mockResolvedValueOnce({
      success: false,
      error: 'selector_not_found',
      diagnostics: { matched: 0 }
    })
    const { result } = renderHook(() => useSelectorsTabController({}))

    await act(async () => {
      await result.current.handleTestSelectors(
        'gemini',
        { hostname: 'site.com', config: { input: '#i', button: '#b', submitMode: 'mixed' } } as never,
        'card-c'
      )
    })

    expect(mocked.showWarning).toHaveBeenCalledWith(
      'error_selector_not_found',
      'toast_automation_title'
    )
    expect(result.current.validationState['card-c']).toEqual({
      status: 'error',
      error: 'error_selector_not_found',
      diagnostics: { matched: 0 }
    })
  })

  it('handles missing script and execute errors with toast + logger', async () => {
    mocked.generateValidateSelectorsScript.mockResolvedValueOnce('')
    const { result } = renderHook(() => useSelectorsTabController({}))

    await act(async () => {
      await result.current.handleTestSelectors(
        'gemini',
        { hostname: 'site.com', config: { input: '#i', button: '#b', submitMode: 'mixed' } } as never,
        'card-d'
      )
    })
    expect(mocked.showError).toHaveBeenCalledWith('selectors_test_failed', 'toast_automation_title')
    expect(mocked.loggerError).toHaveBeenCalledWith(
      'Failed to validate selectors',
      expect.any(Error)
    )

    mocked.generateValidateSelectorsScript.mockResolvedValueOnce('window.__ok = true')
    mocked.webviewInstance.executeJavaScript.mockRejectedValueOnce(new Error('exec-fail'))
    await act(async () => {
      await result.current.handleTestSelectors(
        'gemini',
        { hostname: 'site.com', config: { input: '#i', button: '#b', submitMode: 'mixed' } } as never,
        'card-e'
      )
    })
    expect(mocked.showError).toHaveBeenCalledWith('selectors_test_failed', 'toast_automation_title')
  })
})
