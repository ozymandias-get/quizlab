/**
 * Magic Selector target-integrity reproduction tests (resolver + cache layer).
 *
 * T06 — two near-identical elements must not be arbitrarily picked (reject mode).
 * T08 — a hidden twin must never win over the visible picked element.
 * T09 — React re-render (node swap) must re-resolve to the replacement.
 * T10 — a connected cache entry whose function drifted must be rejected.
 * T17 — an ambiguous fingerprint recovery must not become repair evidence.
 * T19 — a wrong high-priority selector must not override safe failure.
 * T12 — same-origin iframe selection must re-resolve (regression guard).
 *
 * These tests FAIL on the pre-hardening implementation and PASS after it,
 * except where marked as a guard (already passing, must keep passing).
 */
import {
  generateAutoSendScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it } from 'vitest'

function makeInteractiveButton(doc: Document = document): HTMLButtonElement {
  const button = doc.createElement('button')
  button.setAttribute('aria-label', 'Send message')
  button.textContent = 'Send'
  Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 120 })
  Object.defineProperty(button, 'offsetHeight', { configurable: true, value: 36 })
  return button
}

describe('selector target integrity (resolver + cache)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  it('T06: identical twins are rejected safely instead of picking the first', async () => {
    document.body.innerHTML = `
      <textarea placeholder="Ask"></textarea>
      <textarea placeholder="Ask"></textarea>
    `
    document.body.appendChild(makeInteractiveButton())

    const script = generateValidateSelectorsScript({
      inputCandidates: ['textarea[placeholder="Ask"]'],
      button: 'button[aria-label="Send message"]',
      submitMode: 'click',
      inputFingerprint: { tag: 'textarea', placeholder: 'Ask' }
    })
    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.diagnostics.input.strategy).toBe('none')
    expect(result.diagnostics.input.matchedSelector).toBeNull()
  })

  it('T08: the hidden twin never wins over the visible element', async () => {
    document.body.innerHTML = `
      <textarea placeholder="Ask" style="display:none"></textarea>
      <textarea placeholder="Ask"></textarea>
    `
    document.body.appendChild(makeInteractiveButton())
    // JSDOM reports zero rects; simulate a real browser where the second
    // twin is laid out and visible.
    const twins = [...document.querySelectorAll('textarea[placeholder="Ask"]')]
    twins.forEach((el, i) => {
      Object.defineProperty(el, 'getBoundingClientRect', {
        configurable: true,
        value: () =>
          i === 1
            ? { width: 400, height: 60, top: 100, bottom: 160, left: 0, right: 400, x: 0, y: 100 }
            : { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0, x: 0, y: 0 }
      })
    })

    const script = generateAutoSendScript(
      {
        input: 'textarea[placeholder="Ask"]',
        inputCandidates: ['textarea[placeholder="Ask"]'],
        button: 'button[aria-label="Send message"]',
        submitMode: 'enter_key',
        inputFingerprint: { tag: 'textarea', placeholder: 'Ask' }
      },
      'hello visible',
      false
    )
    const result = await window.eval(script)

    // The action must land on the EXPECTED element — not just any match.
    expect(result.success).toBe(true)
    const [hidden, visible] = twins as unknown as HTMLTextAreaElement[]
    expect(visible.value).toContain('hello visible')
    expect(hidden.value).not.toContain('hello visible')
  })

  it('T09: node swap before automation re-resolves to the replacement', async () => {
    document.body.innerHTML = `<textarea id="composer"></textarea>`
    document.body.appendChild(makeInteractiveButton())

    const script = generateAutoSendScript(
      { input: '#composer', button: 'button[aria-label="Send message"]', submitMode: 'enter_key' },
      'hello',
      false
    )
    const first = await window.eval(script)
    expect(first.success).toBe(true)

    // React-style re-render: swap the node, keep the selector.
    document.getElementById('composer')?.remove()
    const replacement = document.createElement('textarea')
    replacement.id = 'composer'
    document.body.prepend(replacement)

    const second = await window.eval(script)
    expect(second.success).toBe(true)
    expect(second.diagnostics.input.cacheInvalidations).toBeGreaterThan(0)
    expect(second.diagnostics.input.strategy).toBe('direct')
    expect((replacement as HTMLTextAreaElement).value).toContain('hello')
  })

  it('T10: connected cache entry whose selector no longer matches is re-resolved', async () => {
    const input = document.createElement('textarea')
    input.id = 'composer'
    input.setAttribute('class', 'composer composer--active')
    input.setAttribute('placeholder', 'Ask')
    document.body.appendChild(input)
    document.body.appendChild(makeInteractiveButton())

    const script = generateAutoSendScript(
      {
        input: 'textarea.composer.composer--active',
        button: 'button[aria-label="Send message"]',
        submitMode: 'enter_key',
        inputFingerprint: { tag: 'textarea', placeholder: 'Ask' }
      },
      'hello',
      false
    )
    const first = await window.eval(script)
    expect(first.success).toBe(true)
    expect(first.diagnostics.input.strategy).toBe('direct')

    // Same connected node, but it drifted out from under its cached
    // selector (SPA class swap). A silent cache hit would keep trusting the
    // stale entry; the hit must be rejected and the target re-resolved.
    input.setAttribute('class', 'suggestion suggestion--active')

    const second = await window.eval(script)
    // Either the same node is reached through a fresh resolution, or the run
    // fails safe — but it must never report a silent cache hit.
    expect(second.diagnostics.input.strategy).not.toBe('cache')
    expect(second.diagnostics.input.cacheInvalidations).toBeGreaterThan(0)
    if (second.success) {
      expect(input.value).toContain('hello')
    }
  })

  it('T17: ambiguous fingerprint recovery is not trusted in send mode either', async () => {
    document.body.innerHTML = `
      <textarea placeholder="Twin"></textarea>
      <textarea placeholder="Twin"></textarea>
    `
    document.body.appendChild(makeInteractiveButton())

    // The saved primary is gone; only an ambiguous fingerprint remains.
    // Acting on either twin would be a guess, so the send must fail safe
    // instead of trusting an arbitrary twin as a fingerprint hit.
    const script = generateAutoSendScript(
      {
        input: '#vanished-primary',
        button: 'button[aria-label="Send message"]',
        submitMode: 'enter_key',
        inputFingerprint: { tag: 'textarea', placeholder: 'Twin' }
      },
      'hello',
      false
    )
    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.diagnostics.input.strategy).not.toBe('fingerprint')
    expect(result.diagnostics.input.ambiguous).toBe(true)
  }, 20000)

  it('T19: duplicated strong selector with identical twins fails safe', async () => {
    document.body.innerHTML = `
      <input id="dup" type="text" placeholder="Same" />
      <input id="dup" type="text" placeholder="Same" />
    `
    document.body.appendChild(makeInteractiveButton())

    const script = generateValidateSelectorsScript({
      input: '#dup',
      inputCandidates: ['input[placeholder="Same"]'],
      button: 'button[aria-label="Send message"]',
      submitMode: 'click',
      inputFingerprint: { tag: 'input', placeholder: 'Same', safeId: 'dup' }
    })
    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.diagnostics.input.strategy).toBe('none')
  })

  it('T12 guard: same-origin iframe selection re-resolves', async () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument
    if (!iframeDoc || !iframeDoc.body) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }
    const textbox = iframeDoc.createElement('div')
    textbox.setAttribute('role', 'textbox')
    textbox.setAttribute('contenteditable', 'true')
    iframeDoc.body.appendChild(textbox)
    const sendButton = iframeDoc.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
    iframeDoc.body.appendChild(sendButton)

    const script = generateValidateSelectorsScript({
      input: 'div[role="textbox"]',
      button: 'button[aria-label="Send message"]',
      submitMode: 'click',
      inputFingerprint: { tag: 'div', role: 'textbox', contentEditable: true }
    })
    const result = await window.eval(script)
    expect(result.success).toBe(true)
  })

  it('T13: an inaccessible (cross-origin style) frame never breaks resolution', async () => {
    document.body.innerHTML = `<textarea placeholder="Ask"></textarea>`
    document.body.appendChild(makeInteractiveButton())

    // A frame whose document throws on access (cross-origin): the search
    // must skip it and still resolve the main document — never throw, never
    // silently pick elsewhere.
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      get: () => {
        throw new Error('cross-origin denied')
      }
    })

    const script = generateValidateSelectorsScript({
      input: 'textarea[placeholder="Ask"]',
      button: 'button[aria-label="Send message"]',
      submitMode: 'click',
      inputFingerprint: { tag: 'textarea', placeholder: 'Ask' }
    })
    const result = await window.eval(script)
    expect(result.success).toBe(true)
    expect(result.diagnostics.input.strategy).toBe('direct')
  })
})
