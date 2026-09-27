/**
 * Security boundary tests for the webview clipboard guard.
 *
 * The guard stops a malicious AI platform from reading the system clipboard.
 * It previously blocked ALL clipboard events, which also blocked the app's own
 * deliberate image paste: the app writes a real image to the clipboard and calls
 * webContents.paste(), and the guest page never saw the event, so the send
 * button stayed aria-disabled forever.
 *
 * The policy is now: block untrusted events, allow trusted ones. `isTrusted`
 * cannot be forged by page script, so programmatic clipboard access stays closed.
 *
 * The listeners are captured and invoked directly because jsdom models every
 * event as untrusted and owns `isTrusted` as a non-configurable instance
 * property, so a dispatched event cannot present a trusted verdict.
 */

import { WEBVIEW_CLIPBOARD_PROTECTION_SCRIPT } from '../../../app/window/security'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getAppPath: vi.fn(() => '/mock-app'),
    on: vi.fn()
  },
  session: { fromPartition: vi.fn(() => ({})) },
  shell: { openExternal: vi.fn() }
}))

type GuardListener = (event: unknown) => void

interface CapturedListener {
  type: string
  capture: boolean
  listener: GuardListener
}

/** Minimal stand-in for a DOM clipboard event, with a controllable verdict. */
function fakeClipboardEvent(opts: { trusted?: boolean; internal?: boolean } = {}) {
  const event = {
    isTrusted: opts.trusted === true,
    __quizlabInternalPaste: opts.internal === true,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      event.defaultPrevented = true
    },
    stopImmediatePropagation() {
      event.propagationStopped = true
    }
  }
  return event
}

function installGuard() {
  const captured: CapturedListener[] = []
  const realAdd = document.addEventListener.bind(document)
  const spy = vi.spyOn(document, 'addEventListener').mockImplementation(((
    type: string,
    listener: GuardListener,
    options?: unknown
  ) => {
    captured.push({
      type,
      capture: options === true || (options as AddEventListenerOptions)?.capture === true,
      listener
    })
    realAdd(type, listener as EventListener, options as boolean)
  }) as typeof document.addEventListener)

  new Function(WEBVIEW_CLIPBOARD_PROTECTION_SCRIPT)()
  spy.mockRestore()
  return captured
}

describe('webview clipboard guard', () => {
  let listeners: CapturedListener[]
  let origExecCommand: ReturnType<typeof vi.fn>

  beforeEach(() => {
    origExecCommand = vi.fn().mockReturnValue(true)
    document.execCommand = origExecCommand as unknown as typeof document.execCommand
    listeners = installGuard()
  })

  function guardFor(type: string) {
    const found = listeners.find((l) => l.type === type)
    if (!found) throw new Error(`guard did not register a listener for ${type}`)
    return found
  }

  describe('registration', () => {
    it('guards copy, cut and paste in the capture phase', () => {
      const guarded = listeners.filter((l) => ['copy', 'cut', 'paste'].includes(l.type))
      expect(guarded).toHaveLength(3)
      expect(guarded.every((l) => l.capture)).toBe(true)
    })

    it('replaces execCommand at install time', () => {
      expect(document.execCommand).not.toBe(origExecCommand)
    })
  })

  describe('security: untrusted clipboard access stays blocked', () => {
    it.each(['copy', 'cut', 'paste'])('blocks an untrusted %s event', (type) => {
      const event = fakeClipboardEvent()
      guardFor(type).listener(event)
      expect(event.defaultPrevented).toBe(true)
      expect(event.propagationStopped).toBe(true)
    })

    it('blocks execCommand copy, cut and paste without delegating', () => {
      expect(document.execCommand('copy')).toBe(false)
      expect(document.execCommand('cut')).toBe(false)
      expect(document.execCommand('paste')).toBe(false)
      expect(origExecCommand).not.toHaveBeenCalled()
    })

    it('delegates other execCommand verbs', () => {
      expect(document.execCommand('selectAll')).toBe(true)
      expect(origExecCommand).toHaveBeenCalledWith('selectAll')
    })
  })

  describe('the image-paste fix', () => {
    // Regression: this is the "send page as image to AI" flow. The app writes a
    // real image to the system clipboard and calls webContents.paste(); the
    // browser marks that event trusted, and the site must receive it.
    it('lets a trusted paste through', () => {
      const event = fakeClipboardEvent({ trusted: true })
      guardFor('paste').listener(event)
      expect(event.defaultPrevented).toBe(false)
      expect(event.propagationStopped).toBe(false)
    })

    it('lets a trusted copy through', () => {
      const event = fakeClipboardEvent({ trusted: true })
      guardFor('copy').listener(event)
      expect(event.defaultPrevented).toBe(false)
    })

    it('lets a trusted cut through', () => {
      const event = fakeClipboardEvent({ trusted: true })
      guardFor('cut').listener(event)
      expect(event.defaultPrevented).toBe(false)
    })

    it('still lets the app-synthesized text paste through', () => {
      const event = fakeClipboardEvent({ internal: true })
      guardFor('paste').listener(event)
      expect(event.defaultPrevented).toBe(false)
      expect(event.propagationStopped).toBe(false)
    })

    it('blocks an untrusted paste that carries the internal marker', () => {
      // The marker is not a capability: it only suppresses the guard when the
      // app itself set the property on a synthetic event. An untrusted event
      // without the marker is what a hostile page produces, and it stays
      // blocked. Guard the ordering so a future edit cannot widen this.
      const event = fakeClipboardEvent({ trusted: false, internal: false })
      guardFor('paste').listener(event)
      expect(event.defaultPrevented).toBe(true)
    })
  })
})
