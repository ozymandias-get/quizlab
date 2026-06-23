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

describe('AppToolContext - queue behavior', () => {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient()
    return (
      <QueryClientProvider client={client}>
        <AppToolProvider>{children}</AppToolProvider>
      </QueryClientProvider>
    )
  }
  const mockRemoveAllRanges = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockState.autoSend = false
    mockState.webviewInstance = null
    mockState.showError.mockReset()
    mockState.showWarning.mockReset()

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.startsWith('blob:')) {
        return {
          blob: async () => new Blob(['mockData'], { type: 'image/png' })
        }
      }
      throw new Error(`fetch not mocked for ${urlStr}`)
    }) as any

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: vi.fn(() => ({
        rangeCount: 1,
        removeAllRanges: mockRemoveAllRanges
      }))
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues multiple text and image items', () => {
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('First excerpt')
      result.current.queueTextForAi('Second excerpt')
      result.current.queueImageForAi('blob:mock-url', {
        page: 12,
        captureKind: 'selection'
      })
    })

    expect(result.current.pendingAiItems).toHaveLength(3)
    expect(result.current.pendingAiItems[2]).toEqual(
      expect.objectContaining({
        type: 'image',
        page: 12,
        captureKind: 'selection'
      })
    )
  })

  it('queues text to draft when autoSend is on (composer must show before send)', async () => {
    vi.useRealTimers()
    mockState.autoSend = true
    mockState.sendTextToAI.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    await act(async () => {
      result.current.queueTextForAi('draft line')
      await Promise.resolve()
    })

    expect(mockState.sendTextToAI).not.toHaveBeenCalled()
    expect(result.current.pendingAiItems).toHaveLength(1)
    expect(result.current.pendingAiItems[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'draft line' })
    )
    vi.useFakeTimers()
  })

  it('queues image to draft even when autoSend is on', () => {
    mockState.autoSend = true
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueImageForAi('blob:mock-url', {
        page: 5,
        captureKind: 'full-page'
      })
    })

    expect(mockState.sendImageToAI).not.toHaveBeenCalled()
    expect(result.current.pendingAiItems).toHaveLength(1)
    expect(result.current.pendingAiItems[0]).toEqual(
      expect.objectContaining({ type: 'image', page: 5, captureKind: 'full-page' })
    )
  })

  it('queues consecutive full-page captures even when data URLs match (e.g. PDF canvas reuse)', () => {
    const { result } = renderHook(() => useAppTools(), { wrapper })
    const samePixels = 'blob:mock-url-identical'

    act(() => {
      result.current.queueImageForAi(samePixels, { page: 12, captureKind: 'full-page' })
      result.current.queueImageForAi(samePixels, { page: 13, captureKind: 'full-page' })
    })

    expect(result.current.pendingAiItems).toHaveLength(2)
    expect(result.current.pendingAiItems[0]).toEqual(
      expect.objectContaining({ page: 12, captureKind: 'full-page' })
    )
    expect(result.current.pendingAiItems[1]).toEqual(
      expect.objectContaining({ page: 13, captureKind: 'full-page' })
    )
  })

  it('sends multiple images in order with note on the first image and autoSend on each', async () => {
    vi.useRealTimers()
    mockState.sendImageToAI.mockResolvedValue({ success: true, mode: 'paste_only' })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('First excerpt')
      result.current.queueTextForAi('Second excerpt')
      result.current.queueImageForAi('blob:mock-url-one')
      result.current.queueImageForAi('blob:mock-url-two')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Summarize these', autoSend: true })
    })

    expect(mockState.sendImageToAI).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('data:image/png;base64'),
      {
        autoSend: true,
        promptText: 'Summarize these\n\nFirst excerpt\n\n---\n\nSecond excerpt'
      }
    )

    expect(mockState.sendImageToAI).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('data:image/png;base64'),
      {
        autoSend: true,
        promptText: undefined
      }
    )

    expect(mockState.sendTextToAI).not.toHaveBeenCalled()
  })

  it('sends text then image then trailing text with ordered segments', async () => {
    vi.useRealTimers()
    mockState.sendImageToAI.mockResolvedValue({ success: true, mode: 'paste_only' })
    mockState.sendTextToAI.mockResolvedValue({ success: true, mode: 'mixed' })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Before shot')
      result.current.queueImageForAi('blob:mock-url-one')
      result.current.queueTextForAi('After shot')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Task', autoSend: false })
    })

    expect(mockState.sendImageToAI).toHaveBeenCalledTimes(1)
    expect(mockState.sendImageToAI).toHaveBeenCalledWith(
      expect.stringContaining('data:image/png;base64'),
      {
        autoSend: false,
        promptText: 'Task\n\nBefore shot'
      }
    )

    expect(mockState.sendTextToAI).toHaveBeenCalledWith('After shot', { autoSend: false })
  })

  it('sends text-only drafts as a single message', async () => {
    vi.useRealTimers()
    mockState.sendTextToAI.mockResolvedValue({ success: true, mode: 'mixed' })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Only excerpt')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Explain this', autoSend: true })
    })

    expect(mockState.sendTextToAI).toHaveBeenCalledWith('Explain this\n\nOnly excerpt', {
      autoSend: true
    })
  })

  it('clears DOM text selection when pending items are dismissed', () => {
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Dismiss me')
    })

    act(() => {
      result.current.clearPendingAiItems()
    })

    expect(mockRemoveAllRanges).toHaveBeenCalledTimes(1)
    expect(result.current.pendingAiItems).toHaveLength(0)
  })
})
