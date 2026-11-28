/**
 * The boot order of the two unhandled-rejection listeners.
 *
 * A pdf.js render cancellation is routine: a superseded render rejects its
 * promise and nobody awaits it. The guard silences those with
 * `preventDefault()`. The reporter shows an error toast for anything else.
 *
 * They only agree in one order: window listeners run in registration order, so a
 * guard installed after the reporter would get to `preventDefault()` only after
 * the toast had already been decided. This file pins the order the app boots
 * with, because the two installs live in one place now.
 */
import { installErrorReporting } from '@app/lib/errorReporting'
import { useToastStore } from '@shared/stores/toastStore'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function dispatchRejection(reason: unknown): void {
  // A real `unhandledrejection` event is cancelable; a shadowed
  // `defaultPrevented` own property would hide the guard's work.
  const event = new Event('unhandledrejection', { cancelable: true })
  Object.defineProperty(event, 'reason', { value: reason })
  window.dispatchEvent(event)
}

function pdfCancellation(): Error {
  const error = new Error('Rendering cancelled, page 1')
  error.name = 'RenderingCancelledException'
  return error
}

describe('error reporting boot order', () => {
  let uninstall: (() => void) | null = null

  beforeEach(() => {
    useToastStore.getState().clearAll()
  })

  afterEach(() => {
    uninstall?.()
    uninstall = null
    useToastStore.getState().clearAll()
  })

  it('shows no toast for a pdf.js render cancellation', () => {
    uninstall = installErrorReporting()

    dispatchRejection(pdfCancellation())

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('still shows the toast for any other unhandled rejection', () => {
    uninstall = installErrorReporting()

    dispatchRejection(new Error('async loader exploded'))

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('error')
    expect(toasts[0].message).toContain('async loader exploded')
  })

  it('uninstall removes both listeners', () => {
    uninstall = installErrorReporting()
    uninstall()
    uninstall = null

    dispatchRejection(pdfCancellation())
    dispatchRejection(new Error('after uninstall'))

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
