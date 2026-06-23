import { vi } from 'vitest'

import { mockState } from './mockState'

vi.mock('@app/providers/AiContext', () => ({
  useAiMessagingActions: () => ({
    sendTextToAI: (...args: any[]) => (mockState.sendTextToAI as any)(...args),
    sendImageToAI: (...args: any[]) => (mockState.sendImageToAI as any)(...args),
    cancelOngoing: vi.fn()
  }),
  useAiSessionActions: () => ({ setAutoSend: vi.fn() }),
  useAiState: () => ({ autoSend: mockState.autoSend }),
  useAiSessionUiPrefsState: () => ({
    autoSend: mockState.autoSend,
    isTutorialActive: false
  }),
  useAiWebview: () => ({
    getWebviewInstance: () => mockState.webviewInstance
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: (...args: any[]) => (mockState.showError as any)(...args),
    showWarning: (...args: any[]) => (mockState.showWarning as any)(...args)
  })
}))

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: () => ({
    isScreenshotMode: false,
    startScreenshot: vi.fn(),
    closeScreenshot: vi.fn(),
    handleCapture: vi.fn()
  })
}))

vi.mock('@features/automation', () => ({
  useElementPicker: () => ({
    isPickerActive: false,
    startPicker: (...args: any[]) => (mockState.startPicker as any)(...args),
    togglePicker: vi.fn()
  })
}))

vi.mock('@app/providers/app-tool/webviewPickerReadiness', () => ({
  oncePickerReady: vi.fn().mockResolvedValue('dom-ready'),
  waitForWebviewElement: vi.fn().mockResolvedValue({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    isDestroyed: vi.fn(() => false)
  })
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
  GEMINI_WEB_REQUIRES_LOGIN_ERROR: 'error_refresh_failed_requires_login',
  GEMINI_WEB_STATUS_KEY: ['gemini-web', 'status'],
  useGeminiWebOpenLogin: () => ({
    mutateAsync: (...args: any[]) => (mockState.mutateAsync as any)(...args),
    isPending: mockState.geminiLoginPending
  })
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => ({
    geminiWeb: {
      onRefreshEvent: (callback: (...args: any[]) => void) => {
        mockState.onRefreshEvent(callback)
        return () => {} // return a proper unsubscribe function
      }
    }
  })
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: (...args: any[]) => (mockState.invalidateQueries as any)(...args)
    })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

import { AppToolProvider, useAppTools } from '@app/providers/AppToolContext'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('AppToolContext - Gemini web login', () => {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient()
    return (
      <QueryClientProvider client={client}>
        <AppToolProvider>{children}</AppToolProvider>
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockState.webviewInstance = null
    mockState.showError.mockReset()
    mockState.showWarning.mockReset()
    mockState.mutateAsync.mockReset()
    mockState.geminiLoginPending = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks gemini web refresh overlay state from refresh events', async () => {
    let refreshCallback:
      | ((event: {
          phase: 'started' | 'success' | 'failed'
          reason: string
          error?: string
        }) => void)
      | undefined
    ;(mockState.onRefreshEvent as any).mockImplementation((callback: any) => {
      refreshCallback = callback
      return () => {}
    })

    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      refreshCallback?.({ phase: 'started', reason: 'http_401' })
    })
    expect(result.current.isGeminiWebSessionRefreshing).toBe(true)

    act(() => {
      refreshCallback?.({
        phase: 'failed',
        reason: 'login_redirect',
        error: 'error_refresh_failed_requires_login'
      })
    })
    expect(result.current.isGeminiWebSessionRefreshing).toBe(false)
    expect(mockState.showError).toHaveBeenCalledWith('error_refresh_failed_requires_login')
  })

  it('clears the login overlay flag and warned flag when startGeminiWebLogin resolves', async () => {
    mockState.mutateAsync.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    expect(result.current.isGeminiWebLoginInProgress).toBe(false)
    expect(result.current.isGeminiWebLoginDismissed).toBe(false)

    await act(async () => {
      await result.current.startGeminiWebLogin()
    })

    expect(mockState.mutateAsync).toHaveBeenCalledTimes(1)
    expect(result.current.isGeminiWebLoginInProgress).toBe(false)
  })

  it('clears the login overlay flag when the underlying mutateAsync throws', async () => {
    mockState.mutateAsync.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useAppTools(), { wrapper })

    await act(async () => {
      await expect(result.current.startGeminiWebLogin()).rejects.toThrow('boom')
    })

    expect(result.current.isGeminiWebLoginInProgress).toBe(false)
  })

  it('auto-dismisses the overlay and warns the user when the renderer-side safety timeout elapses', async () => {
    mockState.mutateAsync.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      void result.current.startGeminiWebLogin()
    })

    expect(result.current.isGeminiWebLoginInProgress).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    })

    expect(result.current.isGeminiWebLoginInProgress).toBe(false)
    expect(result.current.isGeminiWebLoginDismissed).toBe(true)
    expect(mockState.showWarning).toHaveBeenCalledWith(
      'gws_overlay_timeout_body',
      'gws_overlay_timeout_title'
    )
  })

  it('dismissGeminiWebLoginOverlay hides the overlay locally and warns without aborting the IPC', async () => {
    mockState.mutateAsync.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      void result.current.startGeminiWebLogin()
    })

    expect(result.current.isGeminiWebLoginInProgress).toBe(true)

    act(() => {
      result.current.dismissGeminiWebLoginOverlay()
    })

    expect(result.current.isGeminiWebLoginInProgress).toBe(false)
    expect(result.current.isGeminiWebLoginDismissed).toBe(true)
    expect(mockState.showWarning).toHaveBeenCalledWith(
      'gws_overlay_dismissed_body',
      'gws_overlay_dismissed_title'
    )
    expect(mockState.mutateAsync).toHaveBeenCalledTimes(1)
    expect(result.current.isGeminiWebLoginDismissed).toBe(true)
  })

  it('dismissGeminiWebLoginOverlay is a no-op when no login is in progress', () => {
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.dismissGeminiWebLoginOverlay()
    })

    expect(result.current.isGeminiWebLoginInProgress).toBe(false)
    expect(result.current.isGeminiWebLoginDismissed).toBe(false)
    expect(mockState.showWarning).not.toHaveBeenCalled()
  })

  it('resets the dismissed flag when a new login is started', async () => {
    mockState.mutateAsync.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    mockState.mutateAsync.mockImplementationOnce(() => new Promise(() => {}))
    act(() => {
      void result.current.startGeminiWebLogin()
    })
    act(() => {
      result.current.dismissGeminiWebLoginOverlay()
    })
    expect(result.current.isGeminiWebLoginDismissed).toBe(true)

    await act(async () => {
      await result.current.startGeminiWebLogin()
    })

    expect(result.current.isGeminiWebLoginDismissed).toBe(false)
  })

  it('auto-resets the dismissed flag when the underlying login completes in the background', async () => {
    let resolveLogin!: (value: { success: boolean }) => void
    const loginPromise = new Promise<{ success: boolean }>((resolve) => {
      resolveLogin = resolve
    })
    mockState.mutateAsync.mockReturnValue(loginPromise)

    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      void result.current.startGeminiWebLogin()
    })
    act(() => {
      result.current.dismissGeminiWebLoginOverlay()
    })
    expect(result.current.isGeminiWebLoginDismissed).toBe(true)

    await act(async () => {
      resolveLogin({ success: true })
      await loginPromise
    })

    expect(result.current.isGeminiWebLoginDismissed).toBe(false)
  })

  it('auto-resets the dismissed flag when the underlying login throws after dismissal', async () => {
    let rejectLogin!: (error: Error) => void
    const loginPromise = new Promise<{ success: boolean }>((_resolve, reject) => {
      rejectLogin = reject
    })
    const lateFailure = new Error('late failure')
    process.once('unhandledRejection', (reason) => {
      if (reason === lateFailure) return
      throw reason
    })
    mockState.mutateAsync.mockReturnValue(loginPromise)

    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      void result.current.startGeminiWebLogin()
    })
    act(() => {
      result.current.dismissGeminiWebLoginOverlay()
    })
    expect(result.current.isGeminiWebLoginDismissed).toBe(true)

    await act(async () => {
      rejectLogin(lateFailure)
      await expect(loginPromise).rejects.toThrow('late failure')
    })

    expect(result.current.isGeminiWebLoginDismissed).toBe(false)
  })
})
