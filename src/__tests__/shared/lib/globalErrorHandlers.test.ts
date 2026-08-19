import { installGlobalErrorHandlers } from '@shared/lib/globalErrorHandlers'
import { useToastStore } from '@shared/stores/toastStore'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function createEvent<T extends Event>(type: string, props: Record<string, unknown>): T {
  const event = new Event(type)
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(event, key, { value, configurable: true })
  }
  return event as T
}

function dispatchUnhandledRejection(reason: unknown, preventDefault = false): void {
  const promise = Promise.reject(reason)
  promise.catch(() => {}) // keep the test runner from flagging a real unhandled rejection
  const event = createEvent<PromiseRejectionEvent>('unhandledrejection', {
    promise,
    reason,
    defaultPrevented: false
  })
  if (preventDefault) {
    event.preventDefault = () => {
      Object.defineProperty(event, 'defaultPrevented', { value: true })
    }
    event.preventDefault()
  }
  window.dispatchEvent(event)
}

function dispatchWindowError(message: string, preventDefault = false): void {
  const event = createEvent<ErrorEvent>('error', {
    message,
    error: new Error(message),
    defaultPrevented: false
  })
  if (preventDefault) {
    event.preventDefault = () => {
      Object.defineProperty(event, 'defaultPrevented', { value: true })
    }
    event.preventDefault()
  }
  window.dispatchEvent(event)
}

describe('installGlobalErrorHandlers', () => {
  let uninstall: (() => void) | null = null

  beforeEach(() => {
    useToastStore.getState().clearAll()
    uninstall = null
  })

  afterEach(() => {
    uninstall?.()
    uninstall = null
    useToastStore.getState().clearAll()
  })

  it('shows an error toast for unhandled promise rejections', () => {
    uninstall = installGlobalErrorHandlers()

    dispatchUnhandledRejection(new Error('async loader exploded'))

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('error')
    expect(toasts[0].message).toContain('async loader exploded')
  })

  it('shows an error toast for uncaught window errors', () => {
    uninstall = installGlobalErrorHandlers()

    dispatchWindowError('event handler boom')

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toContain('event handler boom')
  })

  it('respects defaultPrevented (e.g. pdf render guard) and stays silent', () => {
    uninstall = installGlobalErrorHandlers()

    dispatchUnhandledRejection(new Error('RenderingCancelledException'), true)
    dispatchWindowError('canvas context is locked', true)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('ignores benign errors like ResizeObserver loop and undefined reasons', () => {
    uninstall = installGlobalErrorHandlers()

    dispatchUnhandledRejection(undefined)
    dispatchWindowError('ResizeObserver loop completed with undelivered notifications')

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('uninstall removes the listeners', () => {
    uninstall = installGlobalErrorHandlers()
    uninstall()
    uninstall = null

    dispatchUnhandledRejection(new Error('after uninstall'))
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
