import { usePickerConsoleBridge } from '@features/automation/hooks/usePickerConsoleBridge'

import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

type ConsoleHandler = (event: { message: string }) => void

interface MockController {
  executeJavaScript: ReturnType<typeof vi.fn>
  subscribeEvent: ReturnType<typeof vi.fn>
  _unsubscribed: ReturnType<typeof vi.fn>
}

/**
 * Stands in for an `AiContentController`: the picker result now arrives on the
 * controller's typed console channel instead of a `<webview>` DOM event.
 */
function buildMockController(handlerSink: { current: ConsoleHandler | null }): MockController {
  const unsubscribed = vi.fn()
  return {
    executeJavaScript: vi.fn(),
    _unsubscribed: unsubscribed,
    subscribeEvent: vi.fn((kind: string, handler: ConsoleHandler) => {
      if (kind !== 'console-message') return () => {}
      handlerSink.current = handler
      return () => {
        handlerSink.current = null
        unsubscribed()
      }
    })
  }
}

describe('usePickerConsoleBridge', () => {
  let handlerSink: { current: ConsoleHandler | null }
  let mockController: MockController

  beforeEach(() => {
    vi.clearAllMocks()
    handlerSink = { current: null }
    mockController = buildMockController(handlerSink)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = (active: { current: unknown } = { current: mockController }) => {
    const onResult = vi.fn()
    const onCancelled = vi.fn()
    const onError = vi.fn()
    const mountedRef = { current: true }

    const utils = renderHook(() => {
      const ref = useRef(mountedRef.current)
      ref.current = mountedRef.current
      return usePickerConsoleBridge({
        getContentController: () => active.current as never,
        onResult,
        onCancelled,
        onError,
        mountedRef
      })
    })

    return { ...utils, onResult, onCancelled, onError, mountedRef, active }
  }

  it('subscribes to the controller console channel on startListening', () => {
    const { result } = setup()
    result.current.startListening()
    expect(mockController.subscribeEvent).toHaveBeenCalledWith(
      'console-message',
      expect.any(Function)
    )
  })

  it('routes _aiPicker:result messages to onResult with parsed payload and stops listening', () => {
    const { result, onResult, onCancelled, onError } = setup()
    result.current.startListening()

    const payload = { inputFingerprint: { tag: 'textarea' } }
    handlerSink.current?.({ message: `_aiPicker:result:${JSON.stringify(payload)}` })

    expect(onResult).toHaveBeenCalledWith(payload, null)
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(mockController._unsubscribed).toHaveBeenCalledTimes(1)
  })

  it('routes _aiPicker:cancelled messages to onCancelled and stops listening', () => {
    const { result, onResult, onCancelled, onError } = setup()
    result.current.startListening()
    handlerSink.current?.({ message: '_aiPicker:cancelled' })

    expect(onCancelled).toHaveBeenCalledTimes(1)
    expect(onResult).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(mockController._unsubscribed).toHaveBeenCalledTimes(1)
  })

  it('routes malformed result payloads to onError', () => {
    const { result, onResult, onCancelled, onError } = setup()
    result.current.startListening()
    handlerSink.current?.({ message: '_aiPicker:result:{not-json' })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onResult).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
  })

  it('ignores messages that are not picker messages', () => {
    const { result, onResult, onCancelled, onError } = setup()
    result.current.startListening()
    handlerSink.current?.({ message: 'console.log("hi")' })

    expect(onResult).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('stops listening when the active tab changed under it', () => {
    const { result, onCancelled, active } = setup()
    result.current.startListening()

    active.current = {}
    handlerSink.current?.({ message: '_aiPicker:cancelled' })

    expect(onCancelled).not.toHaveBeenCalled()
    expect(mockController._unsubscribed).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes on stopListening', () => {
    const { result } = setup()
    result.current.startListening()
    result.current.stopListening()
    expect(mockController._unsubscribed).toHaveBeenCalledTimes(1)
  })

  // The three session-binding cases below used to live in a separate
  // pickerSessionBridge.test.tsx whose entire scaffold was a verbatim copy of
  // this file's. They belong here: same hook, same `setup()`, same fixtures.
  it('T15: a result from a previous session is ignored by the new session', () => {
    const { result, onResult } = setup()
    result.current.startListening(mockController as never, 'session-2')

    // Stale emit from session-1 (different nonce) must not be accepted.
    handlerSink.current?.({
      message: `_aiPicker:result:session-1:${JSON.stringify({ inputFingerprint: {}, buttonFingerprint: {} })}`
    })
    expect(onResult).not.toHaveBeenCalled()

    // The current session result is accepted.
    const payload = { inputFingerprint: { tag: 'textarea' }, buttonFingerprint: { tag: 'button' } }
    handlerSink.current?.({
      message: `_aiPicker:result:session-2:${JSON.stringify(payload)}`
    })
    expect(onResult).toHaveBeenCalledWith(payload, 'session-2')
  })

  it('T15b: legacy result without a session is ignored once a session is active', () => {
    const { result, onResult } = setup()
    result.current.startListening(mockController as never, 'session-9')

    handlerSink.current?.({
      message: `_aiPicker:result:${JSON.stringify({ inputFingerprint: {}, buttonFingerprint: {} })}`
    })
    expect(onResult).not.toHaveBeenCalled()
  })

  it('T14 guard: messages after stopListening are dropped', () => {
    const { result, onResult } = setup()
    result.current.startListening(mockController as never, 'session-3')
    result.current.stopListening()

    handlerSink.current?.({
      message: `_aiPicker:result:session-3:${JSON.stringify({ inputFingerprint: {}, buttonFingerprint: {} })}`
    })
    expect(onResult).not.toHaveBeenCalled()
  })
})
