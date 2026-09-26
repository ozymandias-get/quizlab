/**
 * Self-healing evidence produced by the injected automation runtime.
 *
 * These tests run the *real* generated scripts in jsdom, so they cover the
 * whole recovery path (selector engine → fallback → evidence annotation →
 * generator finalization) rather than a mocked approximation. The important
 * behavioural claims are:
 *
 *  - a working primary selector never starts a repair;
 *  - a real recovery produces a *persistable* CSS selector, not a runtime
 *    marker, even when the element was found by fingerprint or semantics;
 *  - "found" is never enough — only a completed pipeline operation counts as a
 *    successful usage;
 *  - ambiguity, blocklisted send controls and build-generated class selectors
 *    all refuse to produce promotable evidence;
 *  - Shadow DOM, same-origin iframes and SPA navigation keep working.
 */
import {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'
import { selectorRepairRuntimeConstants } from '@electron/features/automation/automationScripts/lib/selectorRepairRuntime'
import {
  MIN_AUTO_REPAIR_SCORE_GAP,
  SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
} from '@shared-core/selectorRepair'

import { beforeEach, describe, expect, it } from 'vitest'

interface LocatorDiagnostics {
  strategy: string
  matchedSelector: string | null
  recovered?: boolean
  stableSelector?: string | null
  ambiguous?: boolean
  unstableSelector?: boolean
  repairEligible?: boolean
  repairReason?: string
  operationSucceeded?: boolean
  confidenceLevel?: string
  confidenceScore?: number
}

function clearCache() {
  delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
    .__quizlabReaderAutomationCache
}

function setElementBox(el: Element, width = 240, height = 40) {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width })
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height })
  el.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 }) as DOMRect
}

describe('selector self-healing evidence', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearCache()
  })

  it('does not start a repair when the primary selector still works', async () => {
    document.body.innerHTML = `<form role="form"><textarea id="prompt"></textarea></form>`
    const input = document.getElementById('prompt')
    if (input) setElementBox(input, 420, 60)

    const result = await window.eval(
      generateAutoSendScript(
        { input: '#prompt', button: null, submitMode: 'enter_key' },
        'hi',
        false
      )
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(diagnostics.strategy).toBe('direct')
    expect(diagnostics.recovered).toBe(false)
    expect(diagnostics.repairEligible).toBe(false)
    expect(diagnostics.repairReason).toBe('not_recovered')
    expect(diagnostics.stableSelector ?? null).toBeNull()
  })

  it('produces repair evidence when a broken primary falls back to a candidate', async () => {
    document.body.innerHTML = `
      <form role="form">
        <textarea data-testid="composer-input" aria-label="Message"></textarea>
      </form>
    `
    const input = document.querySelector('textarea')
    if (input) setElementBox(input, 420, 60)

    const result = await window.eval(
      generateAutoSendScript(
        {
          input: '#gone',
          inputCandidates: ['textarea[data-testid="composer-input"]'],
          submitMode: 'enter_key'
        },
        'hello',
        false
      )
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(diagnostics.strategy).toBe('candidate')
    expect(diagnostics.recovered).toBe(true)
    expect(diagnostics.repairEligible).toBe(true)
    expect(diagnostics.repairReason).toBe('eligible')
    expect(diagnostics.stableSelector).toBe('textarea[data-testid="composer-input"]')
    expect(diagnostics.operationSucceeded).toBe(true)
  })

  it('produces a persistable CSS selector when a fingerprint finds the element', async () => {
    document.body.innerHTML = `<div role="textbox" contenteditable="true" data-testid="ask"></div>`
    const box = document.querySelector('[role="textbox"]')
    if (box) setElementBox(box, 400, 60)

    const result = await window.eval(
      generateFocusScript({
        input: '#gone',
        inputFingerprint: {
          tag: 'div',
          role: 'textbox',
          contentEditable: true,
          dataTestId: 'ask',
          ariaLabel: 'Message'
        }
      })
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(diagnostics.strategy).toBe('fingerprint')
    expect(diagnostics.recovered).toBe(true)
    // Focus alone is not a real usage, so nothing is promotable yet.
    expect(diagnostics.operationSucceeded).toBeUndefined()
    expect(diagnostics.stableSelector).toBe('div[data-testid="ask"]')
  })

  it('recovers semantically and counts the send as one observed success', async () => {
    // No working selector and no fingerprint: the engine has to fall through to
    // semantics. The selector the repair proposes still has to be real CSS.
    document.body.innerHTML = `<form role="form"><textarea aria-label="Ask anything"></textarea></form>`
    const textarea = document.querySelector('textarea')
    if (textarea) setElementBox(textarea, 420, 60)

    const result = await window.eval(
      generateAutoSendScript({ input: '#stale', submitMode: 'enter_key' }, 'hello there', false)
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(diagnostics.strategy).toBe('semantic')
    expect(diagnostics.recovered).toBe(true)
    // The text really landed in the recovered field, so this is one observed
    // success even though the primary is still stale.
    expect(diagnostics.operationSucceeded).toBe(true)
    expect(diagnostics.confidenceLevel).toBe('high')
    // Semantic recovery found the element; the Magic Selector's generator turns
    // it into a stable CSS selector that is safe to persist.
    expect(diagnostics.stableSelector).toBe('textarea[aria-label="Ask anything"]')
    expect(diagnostics.repairEligible).toBe(true)
  }, 20000)

  it('never marks a plain element lookup as a successful usage', async () => {
    document.body.innerHTML = `<div role="textbox" contenteditable="true" data-testid="ask"></div>`
    const box = document.querySelector('[role="textbox"]')
    if (box) setElementBox(box, 400, 60)

    const result = await window.eval(
      generateValidateSelectorsScript({
        input: '#gone',
        inputFingerprint: { tag: 'div', role: 'textbox', dataTestId: 'ask' }
      })
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(diagnostics.recovered).toBe(true)
    // A validation run resolves elements but never uses them.
    expect(diagnostics.operationSucceeded).toBeUndefined()
  })

  it('refuses to promote a build-generated class selector', async () => {
    // The generated class is the *only* anchor on this element, so it is also
    // the only selector the picker would derive — and it must not be persisted.
    document.body.innerHTML = `
      <form role="form">
        <textarea class="css-1x2y3z"></textarea>
      </form>
    `
    const textarea = document.querySelector('textarea')
    if (textarea) setElementBox(textarea, 420, 60)

    const result = await window.eval(
      generateAutoSendScript(
        { input: '#stale', inputCandidates: ['textarea'], submitMode: 'enter_key' },
        'hi',
        false
      )
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(diagnostics.recovered).toBe(true)
    expect(diagnostics.unstableSelector).toBe(true)
    expect(diagnostics.repairEligible).toBe(false)
    expect(['unstable_selector', 'no_stable_selector']).toContain(diagnostics.repairReason)
    expect(diagnostics.stableSelector ?? null).toBeNull()
  })

  it('refuses to promote a send-control candidate that the blocklist rejects', async () => {
    document.body.innerHTML = `
      <form role="form">
        <textarea data-testid="ask" aria-label="Message"></textarea>
      </form>
      <button data-testid="stop-button" aria-label="Stop generating">Stop</button>
    `
    const input = document.querySelector('textarea')
    if (input) setElementBox(input, 420, 60)
    const stop = document.querySelector('button')
    if (stop) setElementBox(stop, 40, 40)

    const result = await window.eval(
      generateClickSendScript({
        input: 'textarea',
        button: '#no-such-button',
        buttonCandidates: ['button[data-testid="stop-button"]'],
        submitMode: 'click'
      })
    )

    const diagnostics = result.diagnostics.button as LocatorDiagnostics
    expect(diagnostics.recovered).toBe(true)
    expect(diagnostics.repairEligible).toBe(false)
    expect(diagnostics.repairReason).toBe('blocked_send_control')
    expect(diagnostics.stableSelector ?? null).toBeNull()
  })

  it('only marks a send button as used after the click actually happened', async () => {
    document.body.innerHTML = `
      <form role="form">
        <textarea data-testid="ask" aria-label="Message"></textarea>
        <button data-testid="send" aria-label="Send message">Send</button>
      </form>
    `
    const input = document.querySelector('textarea')
    if (input) setElementBox(input, 420, 60)
    const send = document.querySelector('button')
    if (send) setElementBox(send, 40, 40)

    const result = await window.eval(
      generateClickSendScript({
        input: 'textarea',
        button: '#no-such-button',
        buttonCandidates: ['button[data-testid="send"]'],
        submitMode: 'click'
      })
    )

    const buttonDiagnostics = result.diagnostics.button as LocatorDiagnostics
    const inputDiagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(buttonDiagnostics.strategy).toBe('candidate')
    expect(buttonDiagnostics.recovered).toBe(true)
    expect(buttonDiagnostics.repairEligible).toBe(true)
    expect(buttonDiagnostics.stableSelector).toBe('button[data-testid="send"]')
    expect(buttonDiagnostics.operationSucceeded).toBe(true)
    // A click submit never touched the input, so the input must not be credited.
    expect(inputDiagnostics.recovered ?? false).toBe(false)
    expect(inputDiagnostics.operationSucceeded ?? false).toBe(false)
  })

  it('never marks a plain element lookup as a successful usage', async () => {
    document.body.innerHTML = `<div role="textbox" contenteditable="true" data-testid="ask"></div>`
    const box = document.querySelector('[role="textbox"]')
    if (box) setElementBox(box, 400, 60)

    const result = await window.eval(
      generateValidateSelectorsScript({
        input: '#gone',
        inputFingerprint: { tag: 'div', role: 'textbox', dataTestId: 'ask' }
      })
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(diagnostics.recovered).toBe(true)
    // A validation run resolves elements but never uses them.
    expect(diagnostics.operationSucceeded).toBeUndefined()
  })

  it('replays repair evidence on a warm cache hit so the streak can grow', async () => {
    document.body.innerHTML = `<form role="form"><textarea data-testid="ask" aria-label="Message"></textarea></form>`
    const textarea = document.querySelector('textarea')
    if (textarea) setElementBox(textarea, 420, 60)

    const script = generateAutoSendScript(
      {
        input: '#gone',
        inputCandidates: ['textarea[data-testid="ask"]'],
        submitMode: 'enter_key'
      },
      'hello',
      false
    )

    const first = await window.eval(script)
    const second = await window.eval(script)

    const firstDiagnostics = first.diagnostics.input as LocatorDiagnostics
    const secondDiagnostics = second.diagnostics.input as LocatorDiagnostics

    expect(firstDiagnostics.strategy).toBe('candidate')
    expect(secondDiagnostics.strategy).toBe('cache')
    // Without replaying the evidence a warm cache would look like "no recovery",
    // and the promotion threshold could never be reached.
    expect(secondDiagnostics.recovered).toBe(true)
    expect(secondDiagnostics.repairEligible).toBe(true)
    expect(secondDiagnostics.stableSelector).toBe('textarea[data-testid="ask"]')
    expect(secondDiagnostics.operationSucceeded).toBe(true)
  })

  it('keeps fingerprint recovery working inside shadow DOM', async () => {
    const host = document.createElement('rich-textarea')
    host.id = 'composer-host'
    const shadow = host.attachShadow({ mode: 'open' })
    const input = document.createElement('div')
    input.setAttribute('role', 'textbox')
    input.setAttribute('contenteditable', 'true')
    input.setAttribute('data-testid', 'shadow-prompt')
    shadow.appendChild(input)
    document.body.appendChild(host)

    const result = await window.eval(
      generateAutoSendScript(
        {
          input: '#gone',
          inputFingerprint: {
            tag: 'div',
            role: 'textbox',
            contentEditable: true,
            dataTestId: 'shadow-prompt',
            hostChain: [
              { selector: '#composer-host', tag: 'rich-textarea', safeId: 'composer-host' }
            ]
          }
        },
        'shadow text',
        false
      )
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(diagnostics.strategy).toBe('fingerprint')
    expect(diagnostics.recovered).toBe(true)
    expect(diagnostics.repairEligible).toBe(true)
    expect(diagnostics.stableSelector).toBe('div[data-testid="shadow-prompt"]')
  })

  it('keeps same-origin iframe traversal working', async () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const frameDocument = frame.contentDocument
    if (!frameDocument) throw new Error('frame document unavailable')
    frameDocument.body.innerHTML = `<form role="form"><textarea data-testid="ask" aria-label="Message"></textarea></form>`

    const result = await window.eval(
      generateAutoSendScript(
        {
          input: '#gone',
          inputCandidates: ['textarea[data-testid="ask"]'],
          submitMode: 'enter_key'
        },
        'framed',
        false
      )
    )

    const diagnostics = result.diagnostics.input as LocatorDiagnostics
    expect(result.success).toBe(true)
    expect(diagnostics.strategy).toBe('candidate')
    expect(diagnostics.repairEligible).toBe(true)
  })

  it('does not reuse a stale cache entry after SPA navigation', async () => {
    document.body.innerHTML = `<form role="form"><textarea data-testid="ask" aria-label="Message"></textarea></form>`
    const textarea = document.querySelector('textarea')
    if (textarea) setElementBox(textarea, 420, 60)

    await window.eval(
      generateValidateSelectorsScript({
        input: '#gone',
        inputCandidates: ['textarea[data-testid="ask"]']
      })
    )

    window.dispatchEvent(new Event('__quizlabSpaNav'))
    document.body.innerHTML = ''

    const afterNav = await window.eval(
      generateValidateSelectorsScript({
        input: '#gone',
        inputCandidates: ['textarea[data-testid="ask"]']
      })
    )

    const diagnostics = afterNav.diagnostics.input as LocatorDiagnostics
    // The element is gone: no false "recovered" credit from the stale cache.
    expect(afterNav.success).toBe(false)
    expect(diagnostics.recovered).toBeFalsy()
  }, 15000)

  it('keeps the promotion threshold a single shared constant', () => {
    expect(selectorRepairRuntimeConstants.PROMOTION_SUCCESS_THRESHOLD).toBe(
      SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
    )
    expect(selectorRepairRuntimeConstants.MIN_AUTO_REPAIR_SCORE_GAP).toBe(MIN_AUTO_REPAIR_SCORE_GAP)
  })

  it('never reports a runtime marker selector as a stable selector', async () => {
    document.body.innerHTML = `<form role="form"><textarea data-testid="ask"></textarea></form>`
    const textarea = document.querySelector('textarea')
    if (textarea) setElementBox(textarea, 420, 60)

    const result = await window.eval(
      generateAutoSendScript(
        { input: '#stale', inputCandidates: ['textarea'], submitMode: 'enter_key' },
        'hi',
        false
      )
    )
    const diagnostics = result.diagnostics.input as LocatorDiagnostics

    if (diagnostics.stableSelector) {
      expect(diagnostics.stableSelector).not.toMatch(
        /^(fingerprint|text|semantic|provider|heuristic|gemini|chatgpt|generic|builtin):/
      )
    }
  })
})
