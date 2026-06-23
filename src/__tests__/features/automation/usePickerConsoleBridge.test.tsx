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

type ConsoleHandler = (e: { message: string }) => void

const buildMockController = (handlerSink: { current: ConsoleHandler | null }) => {
  const el = {
    addEventListener: vi.fn((event: string, handler: ConsoleHandler) => {
      if (event === 'console-message') handlerSink.current = handler
    }),
    removeEventListener: vi.fn((event: string) => {
      if (event === 'console-message') handlerSink.current = null
    })
  }
  return {
    getWebview: vi.fn(() => el),
    executeJavaScript: vi.fn(),
    subscribeWebviewElement: vi.fn((cb: (e: typeof el) => void) => {
      cb(el)
      return () => {}
    }),
    _el: el
  }
}

describe('usePickerConsoleBridge', () => {
  let handlerSink: { current: ConsoleHandler | null }
  let mockController: ReturnType<typeof buildMockController>

  beforeEach(() => {
    vi.clearAllMocks()
    handlerSink = { current: null }
    mockController = buildMockController(handlerSink)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = () => {
    const onResult = vi.fn()
    const onCancelled = vi.fn()
    const onError = vi.fn()
    const mountedRef = { current: true }

    const utils = renderHook(() => {
      const ref = useRef(mountedRef.current)
      ref.current = mountedRef.current
      return usePickerConsoleBridge({
        getWebviewInstance: () => mockController as never,
        onResult,
        onCancelled,
        onError,
        mountedRef
      })
    })

    return { ...utils, onResult, onCancelled, onError, mountedRef }
  }

  it('attaches a console-message listener on startListening', () => {
    const { result } = setup()
    result.current.startListening()
    expect(mockController._el.addEventListener).toHaveBeenCalledWith(
      'console-message',
      expect.any(Function)
    )
  })

  it('routes _aiPicker:result messages to onResult with parsed payload and stops listening', () => {
    const { result, onResult, onCancelled, onError } = setup()
    result.current.startListening()
    const payload = { inputFingerprint: { tag: 'textarea' } }
    handlerSink.current?.({ message: `_aiPicker:result:${JSON.stringify(payload)}` })

    expect(onResult).toHaveBeenCalledWith(payload)
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    // listener should be detached after a result
    expect(mockController._el.removeEventListener).toHaveBeenCalledWith(
      'console-message',
      expect.any(Function)
    )
  })

  it('routes _aiPicker:cancelled messages to onCancelled and stops listening', () => {
    const { result, onResult, onCancelled, onError } = setup()
    result.current.startListening()
    handlerSink.current?.({ message: '_aiPicker:cancelled' })

    expect(onCancelled).toHaveBeenCalledTimes(1)
    expect(onResult).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(mockController._el.removeEventListener).toHaveBeenCalledWith(
      'console-message',
      expect.any(Function)
    )
  })

  it('routes malformed result payloads to onError', async () => {
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

  it('detaches the listener on stopListening', () => {
    const { result } = setup()
    result.current.startListening()
    result.current.stopListening()
    expect(mockController._el.removeEventListener).toHaveBeenCalledWith(
      'console-message',
      expect.any(Function)
    )
  })
})
