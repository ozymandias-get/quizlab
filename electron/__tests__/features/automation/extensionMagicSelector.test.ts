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
  payload?: { selector: string; candidates: string[]; sourceUrl: string }
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
  init: (options?: { sessionId?: string; field?: 'input' | 'button' }) => void
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
          field: options.field ?? 'input'
        })
      }
    }
  }

  vi.stubGlobal('chrome', chrome)
  ;(globalThis as { QuizlabSelectorEngine?: unknown }).QuizlabSelectorEngine = new Function(
    `${ENGINE_SOURCE}\n;return QuizlabSelectorEngine;`
  )()
  new Function(PICKER_SOURCE)()
  return harness
}

function pickerHost(): HTMLElement | null {
  return document.querySelector('[data-quizlab-picker-ui]')
}

function shadowButton(host: HTMLElement, index: number): HTMLButtonElement {
  const root = host.shadowRoot
  if (!root) throw new Error('the picker UI must expose its shadow root')
  const buttons = root.querySelectorAll('button')
  const button = buttons[index]
  if (!button) throw new Error(`missing picker button ${index}`)
  return button
}

function pointerDown(element: Element): MouseEvent {
  const event = new window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: 0
  })
  element.dispatchEvent(event)
  return event
}

function keydown(key: string): KeyboardEvent {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('chrome magic selector content script', () => {
  beforeEach(() => {
    const cleanup = (globalThis as { __quizlabPickerCleanup?: () => void }).__quizlabPickerCleanup
    cleanup?.()
    delete (globalThis as { __quizlabPickerCleanup?: unknown }).__quizlabPickerCleanup
    for (const host of document.querySelectorAll('[data-quizlab-picker-ui]')) host.remove()
    document.body.replaceChildren()
  })

  afterEach(() => {
    const cleanup = (globalThis as { __quizlabPickerCleanup?: () => void }).__quizlabPickerCleanup
    cleanup?.()
    delete (globalThis as { __quizlabPickerCleanup?: unknown }).__quizlabPickerCleanup
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
    confirm.click()

    const result = harness.sent.find((message) => message.type === 'selector_pick_result')
    expect(result).toBeDefined()
    expect(result?.sessionId).toBe('session-1')
    expect(result?.field).toBe('button')
    expect(result?.payload?.selector).toBe('button[data-testid="send-button"]')
    expect(result?.payload?.candidates).toContain('button[data-testid="send-button"]')
    expect(result?.payload?.sourceUrl).toBe(window.location.href)
  })

  it('refuses an element that does not match the requested field', () => {
    const harness = createHarness()
    const input = document.createElement('textarea')
    document.body.appendChild(input)

    harness.init({ field: 'button' })
    pointerDown(input)

    // The confirm button is shown, but pressing it reports the mismatch
    // instead of sending a selector for the wrong element type.
    shadowButton(pickerHost() as HTMLElement, 0).click()
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

  it('reports the app outcome without leaving the picker running', async () => {
    const harness = createHarness()
    const input = document.createElement('textarea')
    input.setAttribute('data-testid', 'prompt')
    document.body.appendChild(input)
    harness.init({ field: 'input' })
    pointerDown(input)

    shadowButton(pickerHost() as HTMLElement, 0).click()
    harness.respond({ ok: true, state: 'saved' })
    await Promise.resolve()

    const host = pickerHost() as HTMLElement
    expect(host.shadowRoot?.textContent).toContain('kaydedildi')
  })
})
