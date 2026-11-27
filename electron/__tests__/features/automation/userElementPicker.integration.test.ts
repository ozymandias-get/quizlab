import {
  generateAutoSendScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

import { waitFor } from '@testing-library/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeBoxShadow } from './lib/cssShadowValue'

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

  it('validates input and button selectors that live in different roots', async () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frameDoc = iframe.contentDocument
    if (!frameDoc || !frameDoc.body) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }
    if (iframe.contentWindow) {
      iframe.contentWindow.requestAnimationFrame ??= (cb: FrameRequestCallback) =>
        setTimeout(() => cb(0), 16) as unknown as number
    }

    // Input in the main document, send button inside a same-origin frame. Each
    // locator is context-free CSS, and the runtime searches every root, so the
    // saved pair must still resolve together.
    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    document.body.appendChild(textbox)

    const sendButton = frameDoc.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, get: () => 32 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, get: () => 32 })
    frameDoc.body.appendChild(sendButton)

    eval(generatePickerScript())

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
    expect(pickerResult).toEqual(
      expect.objectContaining({
        input: expect.any(String),
        button: expect.any(String),
        inputFingerprint: expect.any(Object),
        buttonFingerprint: expect.any(Object)
      })
    )

    const validateResult = await window.eval(generateValidateSelectorsScript(pickerResult as any))
    expect(validateResult.success).toBe(true)
  }, 10000)

  it('cancels on Escape coming from inside a same-origin frame', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frameDoc = iframe.contentDocument
    if (!frameDoc) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      eval(generatePickerScript({}, 'frame-session'))
      frameDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

      expect(consoleSpy).toHaveBeenCalledWith('_aiPicker:cancelled:frame-session')
      expect((window as PickerWindow)._aiPickerCancelled).toBe(true)
    } finally {
      consoleSpy.mockRestore()
      ;(window as PickerWindow)._aiPickerCleanup?.()
    }
  })

  it('clears the floating label and hover outline when the page scrolls', () => {
    eval(generatePickerScript())

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))

    // infoBox is created first, labelBox second.
    const labelBox = document.querySelectorAll<HTMLElement>('[data-ai-picker-ui="true"]')[1]
    expect(labelBox?.style.display).toBe('block')
    expect(textarea.classList.contains('_ai-picker-hover-good')).toBe(true)

    // Scroll moves the element under a stationary pointer without firing a
    // pointer event. A label left at the old coordinates would point at a
    // different element and the outline would mark something else.
    document.dispatchEvent(new Event('scroll'))

    expect(labelBox?.style.display).toBe('none')
    expect(textarea.classList.contains('_ai-picker-hover-good')).toBe(false)

    // The next pointer move re-resolves the target.
    textarea.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
    expect(textarea.classList.contains('_ai-picker-hover-good')).toBe(true)
  })

  it('injects the picker stylesheet into same-origin frames and removes it on cleanup', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frameDoc = iframe.contentDocument
    if (!frameDoc) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }

    eval(generatePickerScript())

    const style = frameDoc.querySelector('style[data-ai-picker-style="true"]')
    expect(style).not.toBeNull()
    // The frame must receive the same rules the top document got; without them
    // hover/selected classes were applied to frame elements but painted
    // nothing.
    expect(style?.textContent).toContain('_ai-picker-hover-good')
    expect(style?.textContent).toContain('_ai-picker-selected')

    ;(window as PickerWindow)._aiPickerCleanup?.()
    expect(frameDoc.querySelector('style[data-ai-picker-style="true"]')).toBeNull()

    // A second injection must re-add the sheet (the "already styled" state is
    // the live node, not a stale flag).
    eval(generatePickerScript())
    expect(frameDoc.querySelector('style[data-ai-picker-style="true"]')).not.toBeNull()
  })

  it('re-attaches the picker stylesheet after the page replaces <head>', async () => {
    eval(generatePickerScript())
    expect(document.querySelector('head style[data-ai-picker-style="true"]')).not.toBeNull()

    // SPA hydration / root rewrites can replace the whole head. The observer on
    // <html> sees it; the sheet must move to the new head instead of leaving
    // the overlay mounted without any picker CSS.
    const oldHead = document.head
    oldHead.remove()
    const newHead = document.createElement('head')
    document.documentElement.appendChild(newHead)

    await waitFor(() => {
      expect(document.querySelector('head style[data-ai-picker-style="true"]')).not.toBeNull()
    })
  })

  it('re-styles a frame whose head is replaced', async () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frameDoc = iframe.contentDocument
    if (!frameDoc) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }

    eval(generatePickerScript())
    expect(frameDoc.querySelector('style[data-ai-picker-style="true"]')).not.toBeNull()

    frameDoc.head.remove()
    const newHead = frameDoc.createElement('head')
    frameDoc.documentElement.appendChild(newHead)

    await waitFor(() => {
      expect(frameDoc.querySelector('head style[data-ai-picker-style="true"]')).not.toBeNull()
    })
  })

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
  it('leaves no late timer behind when cleanup runs during the post-save teardown', async () => {
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

    // A late timer would leave the picker's injected DOM behind; the cleanup
    // hook must be gone for good, not merely callable a second time.
    await new Promise<void>((resolve) => setTimeout(resolve, 1000))
    expect(typeof pickerWindow._aiPickerCleanup).toBe('undefined')
  })

  it.each(['selected', 'rejected'] as const)(
    'restores original inline styles when Escape cancels a %s flash',
    (kind) => {
      vi.useFakeTimers()
      try {
        eval(generatePickerScript())
        const textbox = document.createElement('textarea')
        textbox.style.setProperty('transition', 'opacity 1s', 'important')
        textbox.style.setProperty('box-shadow', '1px 2px 3px red', 'important')
        document.body.appendChild(textbox)
        const rejected = document.createElement('span')
        rejected.style.setProperty('transition', 'color 2s', 'important')
        rejected.style.setProperty('box-shadow', '2px 3px 4px blue', 'important')
        document.body.appendChild(rejected)
        const target = kind === 'selected' ? textbox : rejected
        const original = target.getAttribute('style')
        textbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        if (kind === 'rejected') {
          rejected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        }
        expect(normalizeBoxShadow(target.style.boxShadow)).toContain('0 0')
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(target.getAttribute('style')).toBe(original)
        vi.advanceTimersByTime(1000)
        expect(target.getAttribute('style')).toBe(original)
      } finally {
        ;(window as PickerWindow)._aiPickerCleanup?.()
        vi.useRealTimers()
      }
    }
  )

  it('restores inline styles after the latest repeated flash completes', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())
      const textbox = document.createElement('textarea')
      document.body.appendChild(textbox)
      textbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      const rejected = document.createElement('span')
      rejected.style.setProperty('transition', 'color 2s', 'important')
      rejected.style.setProperty('box-shadow', '2px 3px 4px blue', 'important')
      document.body.appendChild(rejected)
      const original = rejected.getAttribute('style')
      rejected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      vi.advanceTimersByTime(100)
      rejected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      vi.advanceTimersByTime(100)
      expect(normalizeBoxShadow(rejected.style.boxShadow)).toContain('#ef4444')
      vi.advanceTimersByTime(100)
      expect(rejected.getAttribute('style')).toBe(original)
    } finally {
      ;(window as PickerWindow)._aiPickerCleanup?.()
      vi.useRealTimers()
    }
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

    expect(normalizeBoxShadow(reject.style.boxShadow)).toContain('#ef4444')
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

  it('includes the picker session in cancellation messages', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      eval(generatePickerScript({}, 'current-session'))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(consoleSpy).toHaveBeenCalledWith('_aiPicker:cancelled:current-session')
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('ignores input events from a different editor in the same document', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())
      const selected = document.createElement('textarea')
      const other = document.createElement('textarea')
      document.body.append(selected, other)
      selected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(document.getElementById('_ai_picker_next_btn')).not.toBeNull()
      other.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      vi.advanceTimersByTime(200)
      expect(document.getElementById('_ai_picker_next_btn')).not.toBeNull()
    } finally {
      ;(window as PickerWindow)._aiPickerCleanup?.()
      vi.useRealTimers()
    }
  })
})
