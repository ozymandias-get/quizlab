/**
 * Streaming replaces the message list many times per second. The scroll effect
 * must ask for one scroll per frame, not one per update: each `scrollIntoView`
 * forces layout, and during a fast reply those adds up to visible jank.
 */
import type { ApiChatMessage } from '@shared-core/types'

import { useApiChatPage } from '@features/ai/hooks/useApiChatPage'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let currentMessages: ApiChatMessage[] = []

vi.mock('@features/ai/queries/useMessagesQuery', () => ({
  useMessagesQuery: () => ({ data: currentMessages }),
  useDeleteMessageMutation: () => ({ mutateAsync: vi.fn() })
}))

vi.mock('@features/ai/queries/useProviderQueries', () => ({
  useApiConfigQuery: () => ({ data: null })
}))

vi.mock('@features/ai/queries/useSendMessageMutation', () => ({
  useSendMessageMutation: () => ({ mutateAsync: vi.fn() }),
  useRegenerateMutation: () => ({ mutateAsync: vi.fn() }),
  useEditAndRegenerateMutation: () => ({ mutateAsync: vi.fn() })
}))

vi.mock('@features/ai/queries/useSessionsQuery', () => ({
  useSessionsQuery: () => ({ data: [], isSuccess: true }),
  useCreateSessionMutation: () => ({ mutateAsync: vi.fn() }),
  useClearSessionMutation: () => ({ mutateAsync: vi.fn() })
}))

vi.mock('@features/ai/store/chatUiStore', () => ({
  useChatUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeSessionIdByTab: {},
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {},
      updateInput: vi.fn(),
      addAttachment: vi.fn(),
      removeAttachment: vi.fn(),
      setSelectedModel: vi.fn(),
      setActiveProvider: vi.fn(),
      setConfigPrompts: vi.fn(),
      setActiveSessionId: vi.fn()
    })
}))

vi.mock('@features/ai/hooks/useApiChatSessionInit', () => ({
  useApiChatSessionInit: () => undefined
}))

vi.mock('@features/ai/hooks/useApiChatHandlers', () => ({
  useApiChatHandlers: () => ({})
}))

let frames: Map<number, FrameRequestCallback>
let nextFrameId: number

function flushFrames(): void {
  const callbacks = [...frames.values()]
  frames.clear()
  act(() => {
    for (const callback of callbacks) callback(0)
  })
}

function message(id: string): ApiChatMessage {
  return { id, role: 'assistant', content: id } as ApiChatMessage
}

describe('useApiChatPage scroll coalescing', () => {
  beforeEach(() => {
    currentMessages = []
    frames = new Map()
    nextFrameId = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id)
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scrolls once per frame for many streaming updates', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(() => useApiChatPage('tab-1'))

    const end = document.createElement('div')
    Object.defineProperty(end, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    result.current.messagesEndRef.current = end

    // The mount effect schedules its own frame; drain it so the assertion below
    // is about the three streaming updates only.
    flushFrames()
    scrollIntoView.mockClear()

    act(() => {
      currentMessages = [message('stream-1')]
      rerender()
    })
    act(() => {
      currentMessages = [message('stream-1'), message('stream-2')]
      rerender()
    })
    act(() => {
      currentMessages = [message('stream-1'), message('stream-2'), message('stream-3')]
      rerender()
    })

    // Nothing has been laid out yet: the three updates share one pending frame.
    expect(scrollIntoView).not.toHaveBeenCalled()

    flushFrames()

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })
})
