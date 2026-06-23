import { useElementPicker } from '@features/automation/hooks/useElementPicker'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockToast = {
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn()
}
vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => mockToast
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

const mockSaveAiConfigMutate = vi.fn()
const mockGeneratePickerScriptMutate = vi.fn()

vi.mock('@platform/electron/api/useAiApi', () => ({
  useSaveAiConfig: () => ({
    mutateAsync: mockSaveAiConfigMutate
  })
}))

vi.mock('@platform/electron/api/useAutomationApi', () => ({
  useGeneratePickerScript: () => ({
    mutateAsync: mockGeneratePickerScriptMutate
  })
}))

describe('useElementPicker', () => {
  let mockWebview: any
  // We hold the "current" webview in a holder so the stable getter below can
  // dereference it lazily on each call.
  let currentWebview: { current: any }
  const mockConsoleListeners: Record<string, ((e: any) => void) | undefined> = {}

  const installConsoleListenerSpy = (controller: any) => {
    for (const key of Object.keys(mockConsoleListeners)) {
      delete mockConsoleListeners[key]
    }
    controller.subscribeWebviewElement = (cb: (el: any) => void) => {
      const el = {
        addEventListener: vi.fn((event: string, handler: any) => {
          mockConsoleListeners[event] = handler
        }),
        removeEventListener: vi.fn((event: string) => {
          mockConsoleListeners[event] = undefined
        })
      }
      controller.getWebview = () => el
      cb(el)
      return () => {}
    }
  }

  const fireConsoleMessage = (message: string) => {
    const handler = mockConsoleListeners['console-message']
    const el = (mockWebview?.getWebview?.() as any) ?? null
    const addListener = el?.addEventListener as ReturnType<typeof vi.fn> | undefined
    const lastCall = addListener?.mock.calls.find(([event]: any[]) => event === 'console-message')
    const fallbackHandler = lastCall?.[1] as ((e: any) => void) | undefined
    const resolved = handler ?? fallbackHandler
    if (!resolved) {
      throw new Error('console-message listener was not attached')
    }
    resolved({ message })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockWebview = {
      executeJavaScript: vi.fn().mockResolvedValue(undefined),
      getURL: vi.fn().mockReturnValue('https://example.com/foo')
    }
    currentWebview = { current: mockWebview }
    installConsoleListenerSpy(mockWebview)

    mockGeneratePickerScriptMutate.mockResolvedValue('// script')
    mockSaveAiConfigMutate.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Stable getters — identity is preserved across renders so the
  // `getWebviewInstance` dep in the mount effect does not churn.
  const stableGetWebview = () => currentWebview.current
  const stableGetNull = () => null

  const renderPicker = (override?: { current: any }) => {
    if (override) currentWebview.current = override.current
    return renderHook(() => useElementPicker(stableGetWebview))
  }

  it('starts picker successfully', async () => {
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    expect(mockGeneratePickerScriptMutate).toHaveBeenCalled()
    expect(mockWebview.executeJavaScript).toHaveBeenCalledWith('// script')
    expect(result.current.isPickerActive).toBe(true)
    expect(mockToast.showInfo).toHaveBeenCalledWith('picker_started_hint')
  })

  it('surfaces picker_webview_not_found when no webview is attached', async () => {
    currentWebview.current = null
    const { result } = renderHook(() => useElementPicker(stableGetNull))

    await act(async () => {
      await result.current.startPicker()
    })

    expect(mockToast.showError).toHaveBeenCalledWith('picker_webview_not_found')
    expect(result.current.isPickerActive).toBe(false)
  })

  it('falls back to picker_init_failed when script generation returns null', async () => {
    mockGeneratePickerScriptMutate.mockResolvedValueOnce(null)
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    expect(mockToast.showError).toHaveBeenCalledWith('picker_init_failed')
    expect(result.current.isPickerActive).toBe(false)
  })

  it('saves selection result emitted by the injected picker script', async () => {
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    const selection = {
      inputFingerprint: { tag: 'textarea' },
      buttonFingerprint: { tag: 'button' }
    }

    await act(async () => {
      fireConsoleMessage(`_aiPicker:result:${JSON.stringify(selection)}`)
    })

    expect(mockSaveAiConfigMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'example.com',
        config: expect.objectContaining({
          version: 2,
          sourceHostname: 'example.com',
          canonicalHostname: 'example.com',
          submitMode: 'mixed',
          health: 'ready',
          inputFingerprint: { tag: 'textarea' },
          buttonFingerprint: { tag: 'button' }
        })
      })
    )
    expect(result.current.isPickerActive).toBe(false)
  })

  it('handles a cancellation emitted by the injected picker script', async () => {
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    await act(async () => {
      fireConsoleMessage('_aiPicker:cancelled')
    })

    expect(result.current.isPickerActive).toBe(false)
    expect(mockToast.showInfo).toHaveBeenCalledWith('picker_cancelled')
  })

  it('surfaces picker_selection_missing when the picker payload is not a config', async () => {
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    await act(async () => {
      fireConsoleMessage('_aiPicker:result:{}')
    })

    expect(mockToast.showError).toHaveBeenCalledWith('picker_selection_missing')
    expect(result.current.isPickerActive).toBe(false)
  })

  it('reports save failures with picker_save_failed (not a PDF error toast)', async () => {
    mockSaveAiConfigMutate.mockRejectedValueOnce(new Error('disk full'))
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    await act(async () => {
      fireConsoleMessage(
        `_aiPicker:result:${JSON.stringify({
          inputFingerprint: { tag: 'textarea' },
          buttonFingerprint: { tag: 'button' }
        })}`
      )
    })

    expect(mockToast.showError).toHaveBeenCalledWith(
      'picker_save_failed',
      undefined,
      expect.objectContaining({ error: 'disk full' })
    )
    expect(result.current.isPickerActive).toBe(false)
  })

  it('stops the picker and runs the cleanup script', async () => {
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    await act(async () => {
      await result.current.stopPicker()
    })

    expect(result.current.isPickerActive).toBe(false)
    expect(mockToast.showInfo).toHaveBeenCalledWith('picker_cancelled')
  })

  it('toggles between start and stop', async () => {
    const { result } = renderPicker()

    await act(async () => {
      await result.current.togglePicker()
    })
    expect(result.current.isPickerActive).toBe(true)

    await act(async () => {
      await result.current.togglePicker()
    })
    expect(result.current.isPickerActive).toBe(false)
  })

  it('cleans up the injected picker artifacts on unmount', async () => {
    const { result, unmount } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    unmount()

    // Cleanup is fire-and-forget; allow the queued resetPickerArtifacts to settle.
    await act(async () => {
      await Promise.resolve()
    })

    const executeCalls = mockWebview.executeJavaScript.mock.calls.map((args: any[]) => args[0])
    expect(executeCalls).toContain(
      'if (window._aiPickerCleanup) window._aiPickerCleanup(); delete window._aiPickerResult; delete window._aiPickerCancelled;'
    )
  })

  // S11: C1 re-entrance guard. Without the guard, the second startPicker
  // would inject a duplicate picker script into the same webview,
  // orphaning the first script's listeners.
  it('ignores a second startPicker call while the first is in flight', async () => {
    // Make the script-generation promise resolve only after we assert, so
    // the first startPicker is still "in flight" when the second runs.
    let resolveGenerate!: (value: string) => void
    mockGeneratePickerScriptMutate.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveGenerate = resolve
      })
    )

    const { result } = renderPicker()

    let firstCall!: Promise<void>
    let secondCall!: Promise<void>
    await act(async () => {
      firstCall = result.current.startPicker()
      secondCall = result.current.startPicker()
    })

    // Now let the first call finish.
    resolveGenerate('// script')
    await act(async () => {
      await firstCall
      await secondCall
    })

    // Exactly one script-generation request should have gone out.
    expect(mockGeneratePickerScriptMutate).toHaveBeenCalledTimes(1)
    expect(mockWebview.executeJavaScript).toHaveBeenCalledTimes(3) // cleanup + reset + script
  })

  // S11: C5 (real bug). Save failure should surface exactly one error
  // toast (the domain-specific `picker_save_failed`), not two
  // (`toast_ai_config_save_failed` would otherwise leak through from
  // useSaveAiConfig's default error path).
  it('shows only picker_save_failed on save failure, not the underlying AI config toast', async () => {
    mockSaveAiConfigMutate.mockRejectedValueOnce(new Error('disk full'))
    const { result } = renderPicker()

    await act(async () => {
      await result.current.startPicker()
    })

    await act(async () => {
      fireConsoleMessage(
        `_aiPicker:result:${JSON.stringify({
          inputFingerprint: { tag: 'textarea' },
          buttonFingerprint: { tag: 'button' }
        })}`
      )
    })

    expect(mockToast.showError).toHaveBeenCalledWith(
      'picker_save_failed',
      undefined,
      expect.objectContaining({ error: 'disk full' })
    )
    // The duplicate AI-config toast must NOT be fired — suppressErrorToast.
    expect(mockToast.showError).not.toHaveBeenCalledWith(
      'toast_ai_config_save_failed',
      expect.anything(),
      expect.anything()
    )
  })

  // S11: webview getter identity churn. The hook should not re-run its
  // mount effect when callers pass a fresh inline arrow on every render
  // because the getter is stabilized via a ref.
  it('does not churn when callers pass an inline webview getter each render', async () => {
    mockWebview = {
      executeJavaScript: vi.fn().mockResolvedValue(undefined),
      getURL: vi.fn().mockReturnValue('https://example.com/')
    }
    currentWebview = { current: mockWebview }
    installConsoleListenerSpy(mockWebview)

    const { result, rerender } = renderHook(() => useElementPicker(() => currentWebview.current))

    await act(async () => {
      await result.current.startPicker()
    })

    const executeCallsAfterStart = mockWebview.executeJavaScript.mock.calls.length

    // Rerender a few times with a brand-new inline getter each time. If
    // the hook depended on the getter identity, the mount effect would
    // fire `resetPickerArtifacts` each render.
    for (let i = 0; i < 5; i++) {
      rerender()
    }

    const executeCallsAfterRerenders = mockWebview.executeJavaScript.mock.calls.length
    expect(executeCallsAfterRerenders).toBe(executeCallsAfterStart)
  })
})
