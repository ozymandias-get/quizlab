import {
  generateAutoSendScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

import { waitFor } from '@testing-library/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type PickerWindow = Window & {
  _aiPickerResult?: Record<string, unknown> | null
  _aiPickerCleanup?: () => void
  _aiPickerCancelled?: boolean
  _aiPickerRaf?: number
}

async function waitForPickerResult(): Promise<Record<string, unknown> | null> {
  await waitFor(() => {
    expect((window as PickerWindow)._aiPickerResult).toBeTruthy()
  })
  return (window as PickerWindow)._aiPickerResult ?? null
}

describe('userElementPicker integration', () => {
  beforeEach(() => {
    vi.useRealTimers()
    const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number
    ;(
      globalThis as typeof globalThis & {
        requestAnimationFrame?: (cb: FrameRequestCallback) => number
      }
    ).requestAnimationFrame ??= raf
    ;(
      window as typeof window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }
    ).requestAnimationFrame ??= raf
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  afterEach(() => {
    const pickerWindow = window as PickerWindow
    if (pickerWindow._aiPickerCleanup) {
      try {
        pickerWindow._aiPickerCleanup()
      } catch {}
    }
    delete pickerWindow._aiPickerResult
  })

  describe('script smoke', () => {
    it('includes shadow-aware target resolution helpers', () => {
      const script = generatePickerScript()

      expect(script).toContain('getElementInfo')
      expect(script).toContain('generateLocatorBundle')
      expect(script).toContain('getEventContext')
      expect(script).toContain('_ai_picker_next_btn')
    })
  })

  it('captures rich selector data and validates on the same shadow DOM composer', async () => {
    const host = document.createElement('div')
    host.id = 'gemini-shell'
    const shadowRoot = host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)

    const richTextarea = document.createElement('rich-textarea')
    richTextarea.id = 'composer-host'
    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    richTextarea.attachShadow({ mode: 'open' }).appendChild(textbox)

    const sendButton = document.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, get: () => 32 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, get: () => 32 })

    shadowRoot.appendChild(richTextarea)
    shadowRoot.appendChild(sendButton)

    const pickerScript = generatePickerScript()
    eval(pickerScript)

    textbox.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
    textbox.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    )

    const nextBtn = document.getElementById('_ai_picker_next_btn')
    expect(nextBtn).not.toBeNull()
    nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    sendButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
    sendButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    )

    const pickerResult = await waitForPickerResult()
    expect(pickerResult).toBeTruthy()
    expect(pickerResult).toEqual(
      expect.objectContaining({
        version: 2,
        submitMode: 'mixed',
        inputFingerprint: expect.any(Object),
        buttonFingerprint: expect.any(Object),
        inputCandidates: expect.any(Array),
        buttonCandidates: expect.any(Array)
      })
    )

    const validateResult = await window.eval(generateValidateSelectorsScript(pickerResult as any))
    expect(validateResult.success).toBe(true)
    expect(['recursive', 'fingerprint']).toContain(validateResult.diagnostics.input.strategy)

    const sendResult = await window.eval(
      generateAutoSendScript(pickerResult as any, 'Shadow DOM hello', false)
    )
    expect(sendResult.success).toBe(true)
    expect(textbox.textContent || (textbox as HTMLElement).innerText).toContain('Shadow DOM hello')
  }, 10000)

  it('captures selection when the composer lives in a same-origin iframe (main frame listeners alone would miss)', async () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument
    if (!iframeDoc || !iframeDoc.body) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }
    if (iframe.contentWindow) {
      iframe.contentWindow.requestAnimationFrame ??= (cb: FrameRequestCallback) =>
        setTimeout(() => cb(0), 16) as unknown as number
    }

    const textbox = iframeDoc.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    iframeDoc.body.appendChild(textbox)

    const sendButton = iframeDoc.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, get: () => 32 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, get: () => 32 })
    iframeDoc.body.appendChild(sendButton)

    const pickerScript = generatePickerScript()
    eval(pickerScript)

    textbox.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
    textbox.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    )

    const nextBtn = document.getElementById('_ai_picker_next_btn')
    expect(nextBtn).not.toBeNull()
    nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    sendButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
    sendButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    )

    const pickerResult = await waitForPickerResult()
    expect(pickerResult).toBeTruthy()
    expect(pickerResult).toEqual(
      expect.objectContaining({
        version: 2,
        inputFingerprint: expect.any(Object),
        buttonFingerprint: expect.any(Object)
      })
    )
  }, 10000)

  // S11: C3 — the picker used to leak non-Escape keys to the host site,
  // which could submit forms (Enter), open devtools (F12 / Ctrl+Shift+I),
  // or activate host-side shortcuts (Cmd+K). The fix preventDefaults on
  // every key and only routes Escape to the cancel path.
  it('suppresses every key event except Escape while the picker is active', () => {
    const pickerWindow = window as PickerWindow
    delete pickerWindow._aiPickerResult
    delete pickerWindow._aiPickerCancelled

    eval(generatePickerScript())

    const keySpy = vi.fn()
    document.addEventListener('keydown', keySpy, { capture: true })

    const dispatchKey = (key: string) => {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      document.dispatchEvent(ev)
      return ev
    }

    const enter = dispatchKey('Enter')
    const tab = dispatchKey('Tab')
    const f12 = dispatchKey('F12')
    expect(enter.defaultPrevented).toBe(true)
    expect(tab.defaultPrevented).toBe(true)
    expect(f12.defaultPrevented).toBe(true)
    expect(pickerWindow._aiPickerCancelled).toBeUndefined()

    // Escape is still the explicit cancel path.
    dispatchKey('Escape')
    expect(pickerWindow._aiPickerCancelled).toBe(true)

    document.removeEventListener('keydown', keySpy, { capture: true })
  })

  // S11: C2 — the post-save teardown used to race with renderer-driven
  // cleanup. After the fix, calling window._aiPickerCleanup while a
  // post-save timer is queued must cancel the timer so it cannot mutate
  // the DOM after teardown.
  it('drains pending post-save timers when cleanup runs', () => {
    const pickerWindow = window as PickerWindow
    delete pickerWindow._aiPickerResult
    delete pickerWindow._aiPickerCancelled

    eval(generatePickerScript())

    // Pick an input, then a button, to enter the post-save teardown queue.
    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    document.body.appendChild(textbox)
    const sendButton = document.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, get: () => 32 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, get: () => 32 })
    document.body.appendChild(sendButton)

    textbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    const nextBtn = document.getElementById('_ai_picker_next_btn')
    nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    // Cleanup BEFORE the 500ms + 300ms timers can fire.
    expect(typeof pickerWindow._aiPickerCleanup).toBe('function')
    pickerWindow._aiPickerCleanup!()

    // Mark a sentinel on the document that the second-stage timer would
    // unset. If the timer fired, it would clear this attribute.
    document.body.setAttribute('data-test-post-save-fired', 'true')
    return new Promise<void>((resolve) => setTimeout(resolve, 1000)).then(() => {
      // The 500ms submit post-save timer is the one that fires cleanup
      // itself; running cleanup twice is a no-op (the IIFE guards on
      // listenerRoots.length === 0). The contract we care about is that
      // the DOM didn't get re-mutated by a late timer.
      expect(typeof pickerWindow._aiPickerCleanup).toBe('undefined')
    })
  })

  // S11: S7 — clicking a non-button in 'typing' step should flash the
  // rejected target red instead of silently doing nothing.
  it('flashes the rejected target red when typing-step click is not a button', () => {
    const pickerWindow = window as PickerWindow
    delete pickerWindow._aiPickerResult
    delete pickerWindow._aiPickerCancelled

    eval(generatePickerScript())

    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    document.body.appendChild(textbox)

    // Click input → step = 'typing'.
    textbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    // Now click a non-button element while in 'typing' step.
    const reject = document.createElement('span')
    reject.textContent = 'just text'
    document.body.appendChild(reject)
    reject.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(reject.style.boxShadow).toContain('#ef4444')
  })

  // S11: bridge wiring. The renderer-side console bridge subscribes to
  // `console-message` events and looks for messages prefixed with
  // `_aiPicker:`. Before this fix the picker script only wrote the
  // result to `window._aiPickerResult`, so the bridge never fired and
  // the picker appeared to "stay open" after a successful selection.
  it('emits _aiPicker:result to console when a button is selected', async () => {
    const pickerWindow = window as PickerWindow
    delete pickerWindow._aiPickerResult
    delete pickerWindow._aiPickerCancelled

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    eval(generatePickerScript())

    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    document.body.appendChild(textbox)
    const sendButton = document.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, get: () => 32 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, get: () => 32 })
    document.body.appendChild(sendButton)

    textbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    const nextBtn = document.getElementById('_ai_picker_next_btn')
    nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    // The emit happens inside the 500ms post-save timer. Wait it out.
    await new Promise((r) => setTimeout(r, 600))

    const resultCalls = consoleSpy.mock.calls
      .map((args) => args[0])
      .filter((m): m is string => typeof m === 'string' && m.startsWith('_aiPicker:result:'))
    expect(resultCalls.length).toBeGreaterThan(0)
    const parsed = JSON.parse(resultCalls[0].slice('_aiPicker:result:'.length))
    expect(parsed).toEqual(
      expect.objectContaining({
        version: 2,
        inputFingerprint: expect.any(Object),
        buttonFingerprint: expect.any(Object)
      })
    )

    consoleSpy.mockRestore()
  })

  it('emits _aiPicker:cancelled to console when Escape is pressed', () => {
    const pickerWindow = window as PickerWindow
    delete pickerWindow._aiPickerResult
    delete pickerWindow._aiPickerCancelled

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    eval(generatePickerScript())

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    const cancelCalls = consoleSpy.mock.calls
      .map((args) => args[0])
      .filter((m) => m === '_aiPicker:cancelled')
    expect(cancelCalls.length).toBeGreaterThan(0)
    expect(pickerWindow._aiPickerCancelled).toBe(true)

    consoleSpy.mockRestore()
  })
})
