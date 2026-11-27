/**
 * The page-side half of the Chrome magic selector.
 *
 * The content script is injected on demand and must behave like a temporary
 * tool, not like a resident observer: it highlights what is under the pointer,
 * swallows the click that would otherwise press the real button, and removes
 * every listener and node once the pick is sent or cancelled.
 *
 * The engine it drives is the same generated file the Electron picker uses, so
 * these tests exercise the real selector algorithm, not a stub.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const EXTENSION_DIR = path.join(process.cwd(), 'extensions/quizlab-session-extension/content')
const ENGINE_SOURCE = readFileSync(path.join(EXTENSION_DIR, 'selector-engine.js'), 'utf-8')
const PICKER_SOURCE = readFileSync(path.join(EXTENSION_DIR, 'picker.js'), 'utf-8')

interface SentMessage {
  type: string
  sessionId?: string
  field?: string
  payload?: {
    selector?: string
    candidates?: string[]
    fingerprint?: Record<string, unknown>
    input?: {
      selector: string
      candidates: string[]
      fingerprint?: Record<string, unknown>
      sourceUrl: string
    }
    button?: {
      selector: string
      candidates: string[]
      fingerprint?: Record<string, unknown>
      sourceUrl: string
    }
    sourceUrl: string
  }
}

interface ChromeDouble {
  runtime: {
    sendMessage: (message: SentMessage, callback: (response: unknown) => void) => void
    onMessage: {
      addListener: (listener: (message: unknown) => void) => void
      removeListener: (listener: (message: unknown) => void) => void
    }
    lastError: undefined
  }
}

interface Harness {
  chrome: ChromeDouble
  sent: SentMessage[]
  respond: (response: unknown) => void
  listeners: ((message: unknown) => void)[]
  init: (options?: {
    sessionId?: string
    field?: 'input' | 'button' | 'pair'
    mode?: 'single' | 'guided'
  }) => void
}

function createHarness(): Harness {
  const sent: SentMessage[] = []
  const listeners: ((message: unknown) => void)[] = []
  let pending: ((response: unknown) => void) | null = null

  const chrome: ChromeDouble = {
    runtime: {
      sendMessage: (message, callback) => {
        sent.push(message)
        pending = callback
        // The worker answers asynchronously; tests decide what it says.
      },
      onMessage: {
        addListener: (listener) => listeners.push(listener),
        removeListener: (listener) => {
          const index = listeners.indexOf(listener)
          if (index >= 0) listeners.splice(index, 1)
        }
      },
      lastError: undefined
    }
  }

  const harness: Harness = {
    chrome,
    sent,
    listeners,
    respond: (response) => {
      const callback = pending
      pending = null
      callback?.(response)
    },
    init: (options = {}) => {
      for (const listener of listeners) {
        listener({
          type: 'quizlab_selector_init',
          sessionId: options.sessionId ?? 'session-1',
          mode: options.mode ?? (options.field === 'pair' ? 'guided' : 'single'),
          field: options.field ?? 'input'
        })
      }
    }
  }

  vi.stubGlobal('chrome', chrome)
  ;(globalThis as { QuizlabSelectorEngine?: unknown }).QuizlabSelectorEngine = new Function(
    `${ENGINE_SOURCE}\n;return QuizlabSelectorEngine;`
  )()
  // The picker UI lives in a closed shadow root. Tests opt into a handle the
  // content script would never expose to the page world.
  ;(globalThis as { __quizlabPickerTestHandles?: boolean }).__quizlabPickerTestHandles = true
  ;(
    globalThis as { __quizlabPickerTestTrustedEvents?: WeakSet<Event> }
  ).__quizlabPickerTestTrustedEvents = trustedEvents
  new Function(PICKER_SOURCE)()
  return harness
}

/** A DOM event the picker accepts as a real user action. */
const trustedEvents = new WeakSet<Event>()
function trustedEvent<T extends Event>(event: T): T {
  trustedEvents.add(event)
  return event
}

function pickerHost(): HTMLElement | null {
  return document.querySelector('[data-quizlab-picker-ui]')
}

function shadowButton(_host: HTMLElement, index: number): HTMLButtonElement {
  const ui = (
    globalThis as {
      __quizlabPickerTestUi?: {
        panel?: HTMLElement
        shadow?: ShadowRoot
        confirmButton?: HTMLButtonElement
        reselectButton?: HTMLButtonElement
        cancelButton?: HTMLButtonElement
      }
    }
  ).__quizlabPickerTestUi
  if (!ui?.shadow) throw new Error('the picker UI must expose its shadow root to the test harness')
  const panelButtons = ui.panel
    ? [...ui.panel.querySelectorAll('button')].filter((btn) => btn.style.display !== 'none')
    : []
  const button = panelButtons[index] ?? ui.shadow.querySelectorAll('button')[index]
  if (!button) throw new Error(`missing picker button ${index}`)
  return button as HTMLButtonElement
}

function shadowActionButton(action: string): HTMLButtonElement {
  const root = (globalThis as { __quizlabPickerTestUi?: { shadow?: ShadowRoot } })
    .__quizlabPickerTestUi?.shadow
  if (!root) throw new Error('the picker UI must expose its shadow root to the test harness')
  const button = root.querySelector(`button[data-quizlab-action="${action}"]`)
  if (!button) throw new Error(`missing picker action button ${action}`)
  return button as HTMLButtonElement
}

function pointerDown(element: Element, trusted = true): MouseEvent {
  const event = new window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: 0
  })
  if (trusted) trustedEvent(event)
  element.dispatchEvent(event)
  return event
}

function keydown(key: string, trusted = true): KeyboardEvent {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  if (trusted) trustedEvent(event)
  window.dispatchEvent(event)
  return event
}

function clickButton(button: HTMLButtonElement, trusted = true): void {
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true })
  if (trusted) trustedEvent(event)
  button.dispatchEvent(event)
}

describe('chrome magic selector content script', () => {
  beforeEach(() => {
    const cleanup = (globalThis as { __quizlabPickerCleanup?: () => void }).__quizlabPickerCleanup
    cleanup?.()
    delete (globalThis as { __quizlabPickerCleanup?: unknown }).__quizlabPickerCleanup
    delete (globalThis as { __quizlabPickerTestUi?: unknown }).__quizlabPickerTestUi
    for (const host of document.querySelectorAll('[data-quizlab-picker-ui]')) host.remove()
    document.body.replaceChildren()
  })

  afterEach(() => {
    const cleanup = (globalThis as { __quizlabPickerCleanup?: () => void }).__quizlabPickerCleanup
    cleanup?.()
    delete (globalThis as { __quizlabPickerCleanup?: unknown }).__quizlabPickerCleanup
    delete (globalThis as { __quizlabPickerTestUi?: unknown }).__quizlabPickerTestUi
    delete (globalThis as { __quizlabPickerTestHandles?: unknown }).__quizlabPickerTestHandles
    delete (globalThis as { __quizlabPickerTestTrustedEvents?: unknown })
      .__quizlabPickerTestTrustedEvents
    vi.unstubAllGlobals()
  })

  it('picks the element under the pointer without pressing the page button', async () => {
    const harness = createHarness()
    const button = document.createElement('button')
    button.setAttribute('data-testid', 'send-button')
    button.setAttribute('aria-label', 'Send message')
    const pageClick = vi.fn()
    button.addEventListener('click', pageClick)
    document.body.appendChild(button)

    harness.init({ field: 'button' })
    const event = pointerDown(button)

    expect(event.defaultPrevented).toBe(true)
    expect(pageClick).not.toHaveBeenCalled()
    expect(pickerHost()).not.toBeNull()

    const confirm = shadowButton(pickerHost() as HTMLElement, 0)
    clickButton(confirm)

    const result = harness.sent.find((message) => message.type === 'selector_pick_result')
    expect(result).toBeDefined()
    expect(result?.sessionId).toBe('session-1')
    expect(result?.field).toBe('button')
    expect(result?.payload?.selector).toBe('button[data-testid="send-button"]')
    expect(result?.payload?.candidates).toContain('button[data-testid="send-button"]')
    const expectedUrl = new URL(window.location.href)
    expect(result?.payload?.sourceUrl).toBe(`${expectedUrl.origin}${expectedUrl.pathname || '/'}`)
  })

  it('omits query/fragment and user-entered input text from the transfer payload', () => {
    const harness = createHarness()
    const input = document.createElement('textarea')
    input.setAttribute('data-testid', 'prompt-textarea')
    input.value = 'my secret prompt'
    input.textContent = 'my secret prompt'
    document.body.appendChild(input)

    const originalHref = window.location.href
    window.history.replaceState({}, '', '/chat/room-1?token=secret#fragment')
    try {
      harness.init({ field: 'input' })
      pointerDown(input)
      clickButton(shadowButton(pickerHost() as HTMLElement, 0))

      const result = harness.sent.find((message) => message.type === 'selector_pick_result')
      expect(result?.payload?.sourceUrl).toBe(`${window.location.origin}/chat/room-1`)
      expect(
        (result?.payload?.fingerprint as Record<string, unknown> | undefined)?.text
      ).toBeUndefined()
    } finally {
      window.history.replaceState({}, '', originalHref)
    }
  })

  it('resolves an icon inside a button to the real button', () => {
    const harness = createHarness()
    const button = document.createElement('button')
    button.setAttribute('data-testid', 'send-button')
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    icon.appendChild(path)
    button.appendChild(icon)
    document.body.appendChild(button)
    harness.init({ field: 'button' })

    pointerDown(path)
    clickButton(shadowButton(pickerHost() as HTMLElement, 0))

    const result = harness.sent.find((message) => message.type === 'selector_pick_result')
    expect(result?.payload?.selector).toBe('button[data-testid="send-button"]')
  })

  it('refuses an element that does not match the requested field', () => {
    const harness = createHarness()
    const input = document.createElement('textarea')
    document.body.appendChild(input)

    harness.init({ field: 'button' })
    pointerDown(input)

    // The confirm button is shown, but pressing it reports the mismatch
    // instead of sending a selector for the wrong element type.
    clickButton(shadowButton(pickerHost() as HTMLElement, 0))
    expect(harness.sent.some((message) => message.type === 'selector_pick_result')).toBe(false)
  })

  it('cancels on Escape, removes its UI and its listeners', () => {
    const harness = createHarness()
    const button = document.createElement('button')
    document.body.appendChild(button)
    harness.init({ field: 'button' })
    pointerDown(button)
    expect(pickerHost()).not.toBeNull()

    const event = keydown('Escape')

    expect(event.defaultPrevented).toBe(true)
    expect(pickerHost()).toBeNull()
    expect(harness.listeners).toHaveLength(0)
    expect(harness.sent.some((message) => message.type === 'selector_pick_cancelled')).toBe(true)
  })

  it('replaces the previous session instead of leaving two overlays behind', () => {
    const harness = createHarness()
    harness.init({ sessionId: 'first' })
    harness.init({ sessionId: 'second' })

    expect(document.querySelectorAll('[data-quizlab-picker-ui]')).toHaveLength(1)
  })

  it('swallows Enter so the focused composer cannot send the message', () => {
    const harness = createHarness()
    const composer = document.createElement('textarea')
    document.body.appendChild(composer)
    harness.init({ field: 'input' })

    const event = keydown('Enter')
    expect(event.defaultPrevented).toBe(true)
  })

  it('blocks the real click and form submit while a pick is open', () => {
    const harness = createHarness()
    const form = document.createElement('form')
    const button = document.createElement('button')
    button.type = 'submit'
    form.appendChild(button)
    document.body.appendChild(form)
    const pageClick = vi.fn()
    const pageSubmit = vi.fn()
    button.addEventListener('click', pageClick)
    form.addEventListener('submit', pageSubmit)
    harness.init({ field: 'button' })

    pointerDown(button)
    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    trustedEvent(click)
    button.dispatchEvent(click)
    const submit = new window.Event('submit', { bubbles: true, cancelable: true })
    trustedEvent(submit)
    form.dispatchEvent(submit)

    expect(click.defaultPrevented).toBe(true)
    expect(submit.defaultPrevented).toBe(true)
    expect(pageClick).not.toHaveBeenCalled()
    expect(pageSubmit).not.toHaveBeenCalled()
  })

  it('swallows Space on a focused button, which would press it on keyup', () => {
    const harness = createHarness()
    const button = document.createElement('button')
    document.body.appendChild(button)
    harness.init({ field: 'button' })

    const event = new window.KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true
    })
    trustedEvent(event)
    button.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('reports the app outcome without leaving the picker running', async () => {
    const harness = createHarness()
    const input = document.createElement('textarea')
    input.setAttribute('data-testid', 'prompt')
    document.body.appendChild(input)
    harness.init({ field: 'input' })
    pointerDown(input)

    clickButton(shadowButton(pickerHost() as HTMLElement, 0))
    harness.respond({ ok: true, state: 'saved' })
    await Promise.resolve()

    const shadow = (globalThis as { __quizlabPickerTestUi?: { shadow?: ShadowRoot } })
      .__quizlabPickerTestUi?.shadow
    expect(shadow?.textContent).toContain('kaydedildi')
  })

  it('ignores a synthetic pointerdown from a page script', () => {
    const harness = createHarness()
    const button = document.createElement('button')
    button.setAttribute('data-testid', 'send')
    document.body.appendChild(button)
    harness.init({ field: 'button' })

    const event = pointerDown(button, false)
    // The page event is swallowed, but nothing is selected and nothing is sent.
    expect(event.defaultPrevented).toBe(true)
    const ui = (
      globalThis as {
        __quizlabPickerTestUi?: {
          toolbarTitle?: HTMLElement
          panel?: HTMLElement
          box?: HTMLElement
        }
      }
    ).__quizlabPickerTestUi
    expect(ui?.toolbarTitle?.textContent).toContain('Sihirli Seçici')
    expect(ui?.panel?.style.display).toBe('none')
    expect(ui?.box?.style.display).not.toBe('block')
    expect(harness.sent.some((message) => message.type === 'selector_pick_result')).toBe(false)
  })

  it('ignores a synthetic click on its own confirm button', async () => {
    const harness = createHarness()
    const button = document.createElement('button')
    button.setAttribute('data-testid', 'send')
    document.body.appendChild(button)
    harness.init({ field: 'button' })
    pointerDown(button)

    clickButton(shadowButton(pickerHost() as HTMLElement, 0), false)
    await Promise.resolve()
    expect(harness.sent.some((message) => message.type === 'selector_pick_result')).toBe(false)
  })

  it('does not let the previous send answer update a newer selection session', async () => {
    const harness = createHarness()
    const first = document.createElement('textarea')
    first.setAttribute('data-testid', 'first')
    document.body.append(first)
    harness.init({ field: 'input' })

    pointerDown(first)
    clickButton(shadowButton(pickerHost() as HTMLElement, 0))
    // A second start replaces the session while the first answer is in flight.
    harness.init({ sessionId: 'session-2', field: 'input' })
    harness.respond({ ok: true, state: 'saved' })
    await Promise.resolve()

    const ui = (
      globalThis as { __quizlabPickerTestUi?: { shadow?: ShadowRoot; panel?: HTMLElement } }
    ).__quizlabPickerTestUi
    // The new session is still running and did not inherit the old success.
    expect(ui?.panel?.style.display).toBe('none')
    expect(ui?.shadow?.textContent).not.toContain('kaydedildi')
    expect(pickerHost()).not.toBeNull()
  })

  it('supports Master-parity 3-stage guided setup with safe typing, draft preservation and pair transfer', async () => {
    vi.useFakeTimers()
    try {
      const harness = createHarness()
      const composer = document.createElement('div')
      composer.setAttribute('contenteditable', 'true')
      composer.setAttribute('role', 'textbox')
      composer.className = 'ProseMirror'
      composer.textContent = 'existing draft '
      const sendBtn = document.createElement('button')
      sendBtn.setAttribute('data-composer-submit', '')
      sendBtn.setAttribute('aria-label', 'Mesaj gönder')
      const pageSendClick = vi.fn()
      sendBtn.addEventListener('click', pageSendClick)
      document.body.append(composer, sendBtn)

      harness.init({ field: 'pair', mode: 'guided' })

      // Stage 1: select message input area
      pointerDown(composer)
      expect(composer.textContent).toBe('existing draft ')

      // Stage 2: type inside selected composer without Enter submitting
      const enterEvent = new window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
      trustedEvent(enterEvent)
      composer.dispatchEvent(enterEvent)
      expect(enterEvent.defaultPrevented).toBe(true)
      expect(pageSendClick).not.toHaveBeenCalled()

      // Advance cleanly or click send button in Stage 3
      vi.advanceTimersByTime(200)
      pointerDown(sendBtn)

      // Review panel appears with QuizLab'a Aktar
      const ui = (
        globalThis as {
          __quizlabPickerTestUi?: { panel?: HTMLElement; panelTitle?: HTMLElement }
        }
      ).__quizlabPickerTestUi
      expect(ui?.panel?.style.display).toBe('block')
      expect(ui?.panelTitle?.textContent).toContain('hazır')

      clickButton(shadowActionButton('confirm'))
      const result = harness.sent.find((message) => message.type === 'selector_pick_result')
      expect(result).toBeDefined()
      expect(result?.field).toBe('pair')
      expect(result?.payload?.input?.selector).toBeTruthy()
      expect(result?.payload?.button?.selector).toBe('[data-composer-submit]')
      expect(pageSendClick).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('accepts a visible editor even when a hidden responsive duplicate shares the selector', () => {
    const harness = createHarness()
    const hidden = document.createElement('textarea')
    hidden.setAttribute('placeholder', 'Ask anything')
    hidden.style.display = 'none'
    const visible = document.createElement('textarea')
    visible.setAttribute('placeholder', 'Ask anything')
    vi.spyOn(visible, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 10,
      right: 300,
      bottom: 80,
      width: 290,
      height: 70,
      x: 10,
      y: 10,
      toJSON: () => ({})
    })
    document.body.append(hidden, visible)

    harness.init({ field: 'input' })
    pointerDown(visible)
    clickButton(shadowActionButton('confirm'))

    const result = harness.sent.find((message) => message.type === 'selector_pick_result')
    expect(result).toBeDefined()
    expect(result?.payload?.selector).toBe('textarea[placeholder="Ask anything"]')
  })

  it('shows a clear stage message when Electron composer is empty and button is not rendered yet', async () => {
    const harness = createHarness()
    const sendBtn = document.createElement('button')
    sendBtn.setAttribute('data-testid', 'send-button')
    document.body.appendChild(sendBtn)

    harness.init({ field: 'button' })
    pointerDown(sendBtn)
    clickButton(shadowActionButton('confirm'))
    harness.respond({
      ok: false,
      state: 'verification_failed',
      reason: 'button_not_rendered_empty_composer'
    })
    await Promise.resolve()

    const ui = (globalThis as { __quizlabPickerTestUi?: { panelMessage?: HTMLElement } })
      .__quizlabPickerTestUi
    expect(ui?.panelMessage?.textContent).toContain('mesaj alanı boş olduğu için')
  })
})
