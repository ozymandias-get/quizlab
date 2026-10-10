import { usePickerConsoleBridge } from '@features/automation/hooks/usePickerConsoleBridge'

import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('usePickerConsoleBridge session binding (T15)', () => {
  let handlerSink: { current: ConsoleHandler | null }
  let mockController: MockController

  beforeEach(() => {
    vi.clearAllMocks()
    handlerSink = { current: null }
    mockController = buildMockController(handlerSink)
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
