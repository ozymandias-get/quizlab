import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppToolProvider, useAppTools } from '@app/providers/AppToolContext'

const mockSendTextToAI = vi.fn()
const mockSendImageToAI = vi.fn()
const mockStartPicker = vi.fn()
const mockWebviewState = {
  instance: null as unknown as Element | null
}

const mockAiState = {
  autoSend: false
}

vi.mock('@app/providers/AiContext', () => ({
  useAiMessagingActions: () => ({
    sendTextToAI: mockSendTextToAI,
    sendImageToAI: mockSendImageToAI
  }),
  useAiCoreWorkspaceActions: () => ({
    setAutoSend: vi.fn()
  }),
  useAiState: () => ({
    autoSend: mockAiState.autoSend
  }),
  useAiSessionUiPrefsState: () => ({
    autoSend: mockAiState.autoSend,
    isTutorialActive: false
  }),
  useAiWebview: () => ({
    webviewInstance: mockWebviewState.instance
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

vi.mock('@features/automation/hooks/useElementPicker', () => ({
  useElementPicker: () => ({
    isPickerActive: false,
    startPicker: mockStartPicker,
    togglePicker: vi.fn()
  })
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
  useGeminiWebOpenLogin: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}))

describe('AppToolContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppToolProvider>{children}</AppToolProvider>
  )
  const mockRemoveAllRanges = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockAiState.autoSend = false
    mockWebviewState.instance = null
    mockStartPicker.mockResolvedValue(undefined)
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
      result.current.queueImageForAi('data:image/png;base64,one', {
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
    mockAiState.autoSend = true
    mockSendTextToAI.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    await act(async () => {
      result.current.queueTextForAi('draft line')
      await Promise.resolve()
    })

    expect(mockSendTextToAI).not.toHaveBeenCalled()
    expect(result.current.pendingAiItems).toHaveLength(1)
    expect(result.current.pendingAiItems[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'draft line' })
    )
    vi.useFakeTimers()
  })

  it('queues image to draft even when autoSend is on', () => {
    mockAiState.autoSend = true
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueImageForAi('data:image/png;base64,xx', {
        page: 5,
        captureKind: 'full-page'
      })
    })

    expect(mockSendImageToAI).not.toHaveBeenCalled()
    expect(result.current.pendingAiItems).toHaveLength(1)
    expect(result.current.pendingAiItems[0]).toEqual(
      expect.objectContaining({ type: 'image', page: 5, captureKind: 'full-page' })
    )
  })

  it('queues consecutive full-page captures even when data URLs match (e.g. PDF canvas reuse)', () => {
    const { result } = renderHook(() => useAppTools(), { wrapper })
    const samePixels = 'data:image/png;base64,identical'

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
    mockSendImageToAI.mockResolvedValue({ success: true, mode: 'paste_only' })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('First excerpt')
      result.current.queueTextForAi('Second excerpt')
      result.current.queueImageForAi('data:image/png;base64,one')
      result.current.queueImageForAi('data:image/png;base64,two')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Summarize these', autoSend: true })
    })

    expect(mockSendImageToAI).toHaveBeenNthCalledWith(1, 'data:image/png;base64,one', {
      autoSend: true,
      promptText: 'Summarize these\n\nFirst excerpt\n\n---\n\nSecond excerpt'
    })
    expect(mockSendImageToAI).toHaveBeenNthCalledWith(2, 'data:image/png;base64,two', {
      autoSend: true,
      promptText: undefined
    })
    expect(mockSendTextToAI).not.toHaveBeenCalled()
  })

  it('sends text then image then trailing text with ordered segments', async () => {
    mockSendImageToAI.mockResolvedValue({ success: true, mode: 'paste_only' })
    mockSendTextToAI.mockResolvedValue({ success: true, mode: 'mixed' })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Before shot')
      result.current.queueImageForAi('data:image/png;base64,one')
      result.current.queueTextForAi('After shot')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Task', autoSend: false })
    })

    expect(mockSendImageToAI).toHaveBeenCalledTimes(1)
    expect(mockSendImageToAI).toHaveBeenCalledWith('data:image/png;base64,one', {
      autoSend: false,
      promptText: 'Task\n\nBefore shot'
    })
    expect(mockSendTextToAI).toHaveBeenCalledWith('After shot', { autoSend: false })
  })

  it('sends text-only drafts as a single message', async () => {
    mockSendTextToAI.mockResolvedValue({ success: true, mode: 'mixed' })
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.queueTextForAi('Only excerpt')
    })

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Explain this', autoSend: true })
    })

    expect(mockSendTextToAI).toHaveBeenCalledWith('Explain this\n\nOnly excerpt', {
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

  it('starts the picker once the active webview becomes ready', async () => {
    mockWebviewState.instance = {
      getURL: vi.fn(() => 'https://chat.openai.com'),
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    } as unknown as Element & { getURL: any; executeJavaScript: any }
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })
})
