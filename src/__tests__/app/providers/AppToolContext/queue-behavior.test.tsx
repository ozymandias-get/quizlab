import { vi } from 'vitest'

import { mockState } from './mockState'

vi.mock('@app/providers/ai-context', () => ({
  useAiMessagingActions: () => ({
    sendTextToAI: (...args: any[]) => (mockState.sendTextToAI as any)(...args),
    sendImageToAI: (...args: any[]) => (mockState.sendImageToAI as any)(...args),
    sendBulkToAI: (...args: any[]) => (mockState.sendBulkToAI as any)(...args),
    cancelOngoing: vi.fn()
  }),
  useAiSessionActions: () => ({ setAutoSend: vi.fn() }),
  useAiState: () => ({ autoSend: mockState.autoSend }),
  useAiSessionUiPrefsState: () => ({
    autoSend: mockState.autoSend
  }),
  useAiTabFocus: () => ({ activeTabId: 'tab-1', currentAI: 'chatgpt' }),
  useAiContent: () => ({
    getContentController: () => mockState.contentController
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

vi.mock('@app/providers/app-tool/aiContentPickerReadiness', () => ({
  oncePickerReady: vi.fn().mockResolvedValue('dom-ready'),
  waitForContentReady: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

import AppToolProvider, {
  useAppToolActions,
  useAppToolQueueState
} from '@app/providers/AppToolContext'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/** These tests exercise the draft queue, so they compose the two slices they read. */
const useQueueAndActions = () => ({ ...useAppToolQueueState(), ...useAppToolActions() })

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
    mockState.contentController = null
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
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

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
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

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
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

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
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })
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

  it('sends multiple images as ONE bulk message with the note once', async () => {
    vi.useRealTimers()
    mockState.sendBulkToAI.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

    act(() => {
      result.current.queueTextForAi('First excerpt')
      result.current.queueTextForAi('Second excerpt')
      result.current.queueImageForAi('blob:mock-url-one')
      result.current.queueImageForAi('blob:mock-url-two')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Summarize these', autoSend: true })
    })

    // Tek mesaj sözleşmesi: tek bulk çağrısı, iki ek, prompt bir kez.
    expect(mockState.sendBulkToAI).toHaveBeenCalledTimes(1)
    expect(mockState.sendImageToAI).not.toHaveBeenCalled()
    expect(mockState.sendTextToAI).not.toHaveBeenCalled()
    const [urls, opts] = mockState.sendBulkToAI.mock.calls[0]
    expect(urls).toHaveLength(2)
    expect(opts.autoSend).toBe(true)
    expect(opts.promptText.match(/Summarize these/g)).toHaveLength(1)
    expect(opts.promptText).toContain('First excerpt')
    expect(opts.promptText).toContain('Second excerpt')
  })

  it('sends text+image as one message (no per-image submit, no silent split)', async () => {
    vi.useRealTimers()
    mockState.sendBulkToAI.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Before shot')
      result.current.queueImageForAi('blob:mock-url-one', {
        page: 12,
        captureKind: 'selection',
        source: {
          docId: 'doc',
          page: 12,
          totalPages: 59,
          captureKind: 'area-image',
          createdAt: 1
        }
      })
      result.current.queueTextForAi('After shot')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Task', autoSend: false })
    })

    expect(mockState.sendBulkToAI).toHaveBeenCalledTimes(1)
    expect(mockState.sendImageToAI).not.toHaveBeenCalled()
    expect(mockState.sendTextToAI).not.toHaveBeenCalled()
    const [urls, opts] = mockState.sendBulkToAI.mock.calls[0]
    expect(urls).toHaveLength(1)
    expect(opts.autoSend).toBe(false)
    // Sıra korunur: metin, görsel başlığı (Sayfa 12/59), metin aynı gövdede.
    expect(opts.promptText).toContain('Before shot')
    expect(opts.promptText).toContain('Sayfa 12/59')
    expect(opts.promptText).toContain('After shot')
    expect(opts.promptText.indexOf('Before shot')).toBeLessThan(
      opts.promptText.indexOf('After shot')
    )
  })

  it('sends text-only drafts as a single message', async () => {
    vi.useRealTimers()
    mockState.sendTextToAI.mockResolvedValue({ success: true, mode: 'mixed' })
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

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

  it('keeps every item when the queue is full (no silent drop)', () => {
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.queueTextForAi(`excerpt ${i}`)
      }
    })

    expect(result.current.pendingAiItems).toHaveLength(20)

    // Limit dolduğunda yeni öğe reddedilir, mevcut öğeler sessizce silinmez.
    act(() => {
      result.current.queueTextForAi('one too many')
    })

    expect(result.current.pendingAiItems).toHaveLength(20)
    expect(result.current.pendingAiItems[0]).toEqual(expect.objectContaining({ text: 'excerpt 0' }))
    expect(mockState.showError).toHaveBeenCalledWith('draft_queue_full')
  })

  it('clears DOM text selection when pending items are dismissed', () => {
    const { result } = renderHook(() => useQueueAndActions(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Dismiss me')
    })

    act(() => {
      result.current.clearPendingAiItems()
    })

    expect(mockRemoveAllRanges).toHaveBeenCalledTimes(1)
    expect(result.current.pendingAiItems).toHaveLength(0)
  })

  // The picker must not be started for content that is gone or not ready yet,
  // and starting it twice for the same tab would leave the host site's overlay
  // and ours both listening for a selection.
  describe('picker readiness', () => {
    it('starts the picker once the active content is ready', async () => {
      mockState.contentController = {
        isReady: () => true,
        isDestroyed: () => false,
        getURL: vi.fn(() => 'https://chat.openai.com'),
        executeJavaScript: vi.fn().mockResolvedValue('complete')
      } as unknown as Element
      const { result } = renderHook(() => useAppToolActions(), { wrapper })

      act(() => {
        result.current.startPickerWhenReady()
      })
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockState.startPicker).toHaveBeenCalledTimes(1)
    })

    it('starts nothing while there is no content controller', async () => {
      mockState.contentController = null
      const { result } = renderHook(() => useAppToolActions(), { wrapper })

      act(() => {
        result.current.startPickerWhenReady()
      })
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockState.startPicker).not.toHaveBeenCalled()
    })
  })
})
