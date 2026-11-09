import { useApiChatHandlers } from '@features/ai/hooks/useApiChatHandlers'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMsgMutation = vi.fn(async () => undefined)

function ref<T>(value: T) {
  return { current: value }
}

function renderHandlers() {
  return renderHook(() =>
    useApiChatHandlers({
      tabId: 'tab-1',
      activeSessionId: undefined,
      messages: [],
      inputValueRef: ref('hello'),
      attachmentsRef: ref<string[]>([]),
      activeProviderIdRef: ref('provider-a'),
      selectedModelRef: ref('model-a'),
      activeProvider: {
        id: 'provider-a',
        name: 'A',
        baseUrl: 'https://a.example',
        models: ['model-a'],
        defaultModel: 'model-a'
      } as never,
      messagesRef: ref([]),
      textareaRef: ref(null),
      messagesEndRef: ref(null),
      addAttachment: vi.fn(),
      removeAttachment: vi.fn(),
      updateInput: vi.fn(),
      setSelectedModel: vi.fn(),
      setActiveProvider: vi.fn(),
      setActiveSessionId: vi.fn(),
      setIsDragging: vi.fn(),
      setIsHistoryModalOpen: vi.fn(),
      scrollToBottom: vi.fn(),
      t: (key: string) => key,
      sendMsgMutation,
      regenerateMutation: vi.fn(),
      editAndRegenMutation: vi.fn(),
      deleteMsgMutation: vi.fn(),
      createSessionMutation: vi.fn(),
      clearSessionMutation: vi.fn()
    })
  )
}

function enterEvent(options: { isComposing?: boolean; keyCode?: number } = {}) {
  return {
    key: 'Enter',
    shiftKey: false,
    nativeEvent: {
      isComposing: options.isComposing ?? false,
      keyCode: options.keyCode ?? 13
    },
    preventDefault: vi.fn()
  } as unknown as React.KeyboardEvent
}

describe('the API chat keyboard handler', () => {
  beforeEach(() => {
    sendMsgMutation.mockClear()
  })

  it('does not send while an IME composition is active', () => {
    const { result } = renderHandlers()
    const event = enterEvent({ isComposing: true })

    act(() => {
      result.current.handleKeyDown(event)
    })

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(sendMsgMutation).not.toHaveBeenCalled()
  })

  it('does not send on the legacy IME keyCode 229', () => {
    const { result } = renderHandlers()
    const event = enterEvent({ keyCode: 229 })

    act(() => {
      result.current.handleKeyDown(event)
    })

    expect(sendMsgMutation).not.toHaveBeenCalled()
  })

  it('sends on a normal Enter', async () => {
    const { result } = renderHandlers()
    const event = enterEvent()

    await act(async () => {
      result.current.handleKeyDown(event)
    })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(sendMsgMutation).toHaveBeenCalledTimes(1)
  })
})
