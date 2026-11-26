/**
 * Magic Selector target-integrity reproduction tests (picker layer).
 *
 * T01 — wrong-category click in the input step must not be saved as input.
 * T02 — an SVG click inside a send wrapper must normalize to the real button.
 * T03 — hover must not paint the wrong category green.
 * T04 — duplicate id must not resolve to the wrong element.
 * T05 — duplicate data-testid must resolve to the picked element or be skipped.
 * T07 — with two composers, the picked composer must be preserved.
 *
 * These tests FAIL on the pre-hardening implementation and PASS after it.
 */
import { generatePickerScript } from '@electron/features/automation/userElementPicker'
import {
  buildCssCandidates,
  GENERATED_TOKEN_REGEX,
  generateLocatorBundle,
  SAFE_CLASS_TOKEN_REGEX
} from '@electron/features/automation/lib/dom/pickerDomRuntime'
import {
  buildInjectedPickerDomHelpers,
  buildInjectedStableSelectorHelper
} from '@electron/features/automation/lib/injectedPickerDom'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeBoxShadow } from './lib/cssShadowValue'

type PickerWindow = Window & {
  _aiPickerResult?: Record<string, unknown> | null
  _aiPickerCleanup?: () => void
  _aiPickerCancelled?: boolean
}

function installRaf() {
  const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number
  const g = globalThis as typeof globalThis & {
    requestAnimationFrame?: (cb: FrameRequestCallback) => number
  }
  g.requestAnimationFrame ??= raf
  const w = window as typeof window & {
    requestAnimationFrame?: (cb: FrameRequestCallback) => number
  }
  w.requestAnimationFrame ??= raf
}

function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))
}

function mouseOver(el: Element) {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true, cancelable: true }))
}

describe('picker target integrity', () => {
  beforeEach(() => {
    vi.useRealTimers()
    installRaf()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    const w = window as PickerWindow
    try {
      w._aiPickerCleanup?.()
    } catch {}
    delete w._aiPickerResult
    delete w._aiPickerCancelled
  })

  it('T01: clicking a button during the input step does not record it as input', () => {
    eval(generatePickerScript())

    const input = document.createElement('textarea')
    input.setAttribute('placeholder', 'Type here')
    document.body.appendChild(input)
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Send message')
    button.textContent = 'Send'
    document.body.appendChild(button)

    // Wrong-category click while the picker is still in the input step.
    click(button)

    // Still in the input step: the typing-step affordance must not appear…
    expect(document.getElementById('_ai_picker_next_btn')).toBeNull()
    // …no element may carry the selected style…
    expect(document.querySelector('._ai-picker-selected')).toBeNull()
    // …and the misclick must be visibly rejected (red flash).
    expect(normalizeBoxShadow(button.style.boxShadow)).toContain('#ef4444')
  })

  it('T02: clicking an SVG inside a send wrapper normalizes to the real button', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())

      const input = document.createElement('textarea')
      input.setAttribute('placeholder', 'Type here')
      document.body.appendChild(input)

      const wrapper = document.createElement('div')
      wrapper.setAttribute('class', 'composer-send')
      const button = document.createElement('button')
      button.setAttribute('aria-label', 'Confirm')
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      button.appendChild(svg)
      wrapper.appendChild(button)
      document.body.appendChild(wrapper)

      click(input)
      document
        .getElementById('_ai_picker_next_btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      // Click the innermost SVG node, as a real user pointer would.
      click(svg as unknown as Element)

      vi.advanceTimersByTime(1000)

      const result = (window as PickerWindow)._aiPickerResult as unknown as {
        buttonFingerprint?: { tag?: string }
        button?: string
      }
      expect(result).toBeTruthy()
      // The persisted locator must describe the BUTTON, not the wrapper div.
      expect(result.buttonFingerprint?.tag).toBe('button')
      expect(String(result.button ?? '')).not.toMatch(/^div/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it('T03: hovering a button during the input step is not painted green', () => {
    eval(generatePickerScript())

    const input = document.createElement('textarea')
    document.body.appendChild(input)
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Send message')
    button.textContent = 'Send'
    document.body.appendChild(button)

    mouseOver(button)

    expect(button.classList.contains('_ai-picker-hover-good')).toBe(false)
  })

  it('T03b: hovering the correct category still paints green', () => {
    eval(generatePickerScript())

    const input = document.createElement('textarea')
    input.setAttribute('placeholder', 'Type here')
    document.body.appendChild(input)

    mouseOver(input)

    expect(input.classList.contains('_ai-picker-hover-good')).toBe(true)
  })

  it('T04: duplicate id — the generated primary resolves to the picked element', () => {
    const first = document.createElement('input')
    first.setAttribute('id', 'dup')
    first.setAttribute('type', 'text')
    document.body.appendChild(first)
    const second = document.createElement('input')
    second.setAttribute('id', 'dup')
    second.setAttribute('type', 'text')
    second.setAttribute('placeholder', 'Target composer')
    document.body.appendChild(second)

    const bundle = generateLocatorBundle(second, 'input')
    expect(bundle).not.toBeNull()
    expect(bundle!.primarySelector).not.toBeNull()

    const resolved = document.querySelector(bundle!.primarySelector as string)
    // Must resolve to the PICKED element, never silently to its twin.
    expect(resolved).toBe(second)
  })

  it('T05: duplicate data-testid — the picked element is preserved', () => {
    const first = document.createElement('textarea')
    first.setAttribute('data-testid', 'composer')
    document.body.appendChild(first)
    const second = document.createElement('textarea')
    second.setAttribute('data-testid', 'composer')
    second.setAttribute('placeholder', 'Second composer')
    document.body.appendChild(second)

    const bundle = generateLocatorBundle(second, 'input')
    expect(bundle).not.toBeNull()

    const resolved = document.querySelectorAll(bundle!.primarySelector as string)
    // Either unique to the picked element, or the picked element must be
    // among verifiable candidates (never an unrelated twin alone).
    const candidates = buildCssCandidates(second, 'input')
    const resolvesToPicked = candidates.some((c) => {
      try {
        return document.querySelector(c) === second
      } catch {
        return false
      }
    })
    expect(resolved.length).toBeGreaterThan(0)
    expect(resolvesToPicked).toBe(true)
  })

  it('T07: with two composers, the picked composer fingerprint is kept', () => {
    const first = document.createElement('textarea')
    first.setAttribute('placeholder', 'Ask anything')
    document.body.appendChild(first)
    const second = document.createElement('textarea')
    second.setAttribute('placeholder', 'Search messages')
    document.body.appendChild(second)

    const bundle = generateLocatorBundle(second, 'input')
    expect(bundle).not.toBeNull()
    expect(bundle!.fingerprint.placeholder).toBe('Search messages')
    expect(document.querySelector(bundle!.primarySelector as string)).toBe(second)
  })

  /**
   * T08 — hashed utility classes must not become fingerprint identity evidence.
   *
   * ChatGPT's composer rotates its `x…` build hashes on every frontend deploy,
   * so persisting them yields selectors that break within days and, worse, a
   * class-overlap score that prefers a wrong element sharing a stale hash.
   */
  it('T08: hashed utility classes never reach the persisted fingerprint or the CSS candidates', () => {
    const el = document.createElement('button')
    el.setAttribute('aria-label', 'Send message')
    el.setAttribute('data-testid', 'send-button')
    el.setAttribute('class', 'x16qrm4 xxyica1 x1cpjm7i x1au5me5 xgkqi7n')
    document.body.appendChild(el)

    const bundle = generateLocatorBundle(el, 'button')
    expect(bundle!.fingerprint.classTokens).toBeUndefined()
    expect(bundle!.candidates).not.toContain('button.x16qrm4.xxyica1.x1cpjm7i')
    for (const candidate of bundle!.candidates) {
      expect(candidate).not.toMatch(/\.x(?:16qrm4|xyica1|1cpjm7i|1au5me5|gkqi7n)\b/)
    }
    // Redeploy-proof evidence is still preferred.
    expect(bundle!.primarySelector).toBe('button[data-testid="send-button"]')
  })

  /**
   * Injection contract: `buildInjectedPickerDomHelpers` re-emits every helper
   * with `fn.toString()` and only mirrors GENERATED_TOKEN_REGEX /
   * SAFE_CLASS_TOKEN_REGEX into the emitted prefix. Any NEW regex the hash
   * filter needs therefore has to travel inside the function body — a
   * module-level const would be an undefined reference in the guest page and
   * would throw at click time, silently breaking the whole picker.
   */
  it('T10: the hash filter survives fn.toString() injection', () => {
    const injected = buildInjectedPickerDomHelpers()
    expect(injected).toContain('HASHED_UTILITY_CLASS_REGEX')

    // And the emitted source must actually evaluate and behave.
    const scope = new Function(
      `${injected}\nreturn typeof getSafeClassTokens === 'function' ? getSafeClassTokens : null;`
    )
    const injectedGetSafeClassTokens = scope() as ((el: Element) => string[]) | null
    expect(injectedGetSafeClassTokens).toBeTypeOf('function')

    const hashed = document.createElement('button')
    hashed.setAttribute('class', 'x16qrm4 xxyica1')
    expect(injectedGetSafeClassTokens!(hashed)).toEqual([])

    const semantic = document.createElement('button')
    semantic.setAttribute('class', 'x16qrm4 ProseMirror send-btn')
    expect(injectedGetSafeClassTokens!(semantic)).toEqual(['ProseMirror', 'send-btn'])
  })

  /**
   * The regex pair is the only module scope the emitted helpers may reference.
   * It used to be copied by hand into injectedPickerDom.ts and had already
   * drifted (spelling/ordering), so a later edit to the runtime pattern would
   * have silently changed guest-page behaviour. Both builders must emit the
   * live values.
   */
  it('T14: injected prefix is derived from the runtime regexes, not a hand copy', () => {
    const generated = `const GENERATED_TOKEN_REGEX = ${String(GENERATED_TOKEN_REGEX)};`
    const safeClass = `const SAFE_CLASS_TOKEN_REGEX = ${String(SAFE_CLASS_TOKEN_REGEX)};`

    expect(buildInjectedPickerDomHelpers()).toContain(generated)
    expect(buildInjectedPickerDomHelpers()).toContain(safeClass)
    expect(buildInjectedStableSelectorHelper()).toContain(generated)
    expect(buildInjectedStableSelectorHelper()).toContain(safeClass)
  })

  /**
   * Privilege boundary: `fn.toString()` carries only the function body, so any
   * module-level value referenced from inside a helper becomes a ReferenceError
   * in the guest page (the picker then dies silently at click time). Evaluate
   * the emitted block standalone and exercise EVERY exported helper.
   */
  it('T15: every emitted DOM helper is self-contained and callable', () => {
    const create = () =>
      new Function(`${buildInjectedPickerDomHelpers()}
        return {
          getSafeId, getNthChild, getSafeClassTokens, normalizeText, getVisibleText,
          pushCandidate, getPrimaryAttribute, isElementContentEditable, cssEscape,
          escapeCssStringValue, buildSelectorSegment, buildLocalPath, buildHostChain,
          buildCssCandidates, safeMatchesSelector, pickVerifiedPrimary,
          inferSendLikeControl, getElementInfo, generateLocatorBundle
        };`)
    const helpers = create()() as Record<string, (...args: any[]) => any>

    const button = document.createElement('button')
    button.setAttribute('id', 'send-btn')
    button.setAttribute('aria-label', 'Send message')
    button.setAttribute('class', 'composer-send x16qrm4')
    button.textContent = 'Send'
    document.body.appendChild(button)

    const input = document.createElement('textarea')
    input.setAttribute('placeholder', 'Ask anything')
    document.body.appendChild(input)

    expect(helpers.getSafeId(button)).toBe('send-btn')
    expect(helpers.getNthChild(button)).toBe(1)
    expect(helpers.getSafeClassTokens(button)).toEqual(['composer-send'])
    expect(helpers.normalizeText('  a   b ')).toBe('a b')
    expect(helpers.getVisibleText(button)).toContain('Send')
    expect(helpers.getPrimaryAttribute(button, 'button')).toEqual({
      attribute: 'aria-label',
      value: 'Send message'
    })
    expect(helpers.isElementContentEditable(input)).toBe(false)
    expect(helpers.cssEscape('a.b')).toBe('a\\.b')
    expect(helpers.escapeCssStringValue('a"b')).toBe('a\\"b')
    expect(helpers.buildSelectorSegment(button)).toBe('#send-btn')
    expect(helpers.buildLocalPath(button).at(-1)).toBe('#send-btn')
    expect(helpers.buildHostChain(button)).toEqual([])
    expect(helpers.inferSendLikeControl(button)).toBe(true)
    expect(helpers.getElementInfo(button).category).toBe('button')
    expect(helpers.getElementInfo(input).category).toBe('input')
    expect(helpers.pushCandidate([], 'x')).toBeUndefined()

    const bundle = helpers.generateLocatorBundle(button, 'button')
    expect(bundle?.primarySelector).toBe('#send-btn')
    expect(helpers.safeMatchesSelector(button, '#send-btn')).toBe(true)
    expect(helpers.pickVerifiedPrimary(button, ['#send-btn'])).toBe('#send-btn')
    expect(helpers.buildCssCandidates(button, 'button')).toContain('#send-btn')

    // The self-healing helper block is emitted separately; it must stand alone
    // too (the same rules, only the transitive callees of buildCssCandidates).
    const stable = new Function(
      `${buildInjectedStableSelectorHelper()}\nreturn buildCssCandidates;`
    )() as (el: Element, kind: 'input' | 'button') => string[]
    expect(stable(input, 'input')).toContain('textarea[placeholder="Ask anything"]')
  })

  it('T16: leaving a hovered element clears its outline, re-entry repaints it', () => {
    eval(generatePickerScript())

    const editor = document.createElement('div')
    editor.setAttribute('role', 'textbox')
    editor.setAttribute('contenteditable', 'true')
    const child = document.createElement('span')
    editor.appendChild(child)
    document.body.appendChild(editor)

    mouseOver(editor)
    expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)

    // Moving onto a descendant is not an exit: the outline must survive.
    editor.dispatchEvent(
      new MouseEvent('mouseout', {
        bubbles: true,
        composed: true,
        relatedTarget: child
      })
    )
    expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)

    // Leaving the element (pointer out of the view) must remove it.
    editor.dispatchEvent(
      new MouseEvent('mouseout', {
        bubbles: true,
        composed: true,
        relatedTarget: document.body
      })
    )
    expect(editor.classList.contains('_ai-picker-hover-good')).toBe(false)

    // Re-entering must repaint (lastHovered was reset, not just un-styled).
    mouseOver(editor)
    expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)
  })

  it('T11: voice and dictation buttons are rejected during the submit step', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())

      const input = document.createElement('textarea')
      input.setAttribute('placeholder', 'Ask anything')
      document.body.appendChild(input)

      const micBtn = document.createElement('button')
      micBtn.setAttribute('aria-label', 'Dikte et')
      micBtn.setAttribute('data-start-dictation', 'true')
      document.body.appendChild(micBtn)

      const sendBtn = document.createElement('button')
      sendBtn.setAttribute('aria-label', 'Send message')
      document.body.appendChild(sendBtn)

      click(input)
      document
        .getElementById('_ai_picker_next_btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

      mouseOver(micBtn)
      expect(micBtn.classList.contains('_ai-picker-hover-good')).toBe(false)
      expect(micBtn.classList.contains('_ai-picker-hover-low')).toBe(true)

      click(micBtn)
      expect(normalizeBoxShadow(micBtn.style.boxShadow)).toContain('#ef4444')
      expect((window as PickerWindow)._aiPickerResult).toBeUndefined()

      click(sendBtn)
      vi.advanceTimersByTime(1000)
      const result = (window as PickerWindow)._aiPickerResult as { button?: string } | undefined
      expect(result?.button).toBe('button[aria-label="Send message"]')
    } finally {
      vi.useRealTimers()
    }
  })

  it('T12: Shadow DOM element uniqueness check scopes to ShadowRoot instead of matching an unrelated outer document element', () => {
    // Outer document has exactly ONE <button>, which previously tricked
    // document.querySelectorAll('button').length === 1 into picking bare 'button'
    // for a Shadow DOM button!
    const outerButton = document.createElement('button')
    outerButton.textContent = 'Outer unrelated button'
    document.body.appendChild(outerButton)

    const host = document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)

    const shadowMic = document.createElement('button')
    shadowMic.setAttribute('aria-label', 'Microphone')
    shadow.appendChild(shadowMic)

    const shadowSend = document.createElement('button')
    shadowSend.setAttribute('aria-label', 'Send prompt')
    shadow.appendChild(shadowSend)

    const bundle = generateLocatorBundle(shadowSend, 'button')
    expect(bundle).not.toBeNull()
    expect(bundle!.primarySelector).toBe('button[aria-label="Send prompt"]')
  })

  it('T13: clicking the selected input in step 2 refocuses it without red flash, and typing in Shadow DOM advances to submit step', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())

      const host = document.createElement('rich-textarea')
      const shadow = host.attachShadow({ mode: 'open' })
      const editor = document.createElement('div')
      editor.setAttribute('role', 'textbox')
      editor.setAttribute('contenteditable', 'true')
      editor.tabIndex = 0
      shadow.appendChild(editor)
      document.body.appendChild(host)

      const sendBtn = document.createElement('button')
      sendBtn.setAttribute('aria-label', 'Send message')
      document.body.appendChild(sendBtn)

      click(editor)
      expect(document.getElementById('_ai_picker_next_btn')).not.toBeNull()

      // Clicking the already-selected input in step 2 ('typing') must not flash red.
      click(editor)
      expect(normalizeBoxShadow(editor.style.boxShadow)).not.toContain('#ef4444')

      // Typing a printable key inside the Shadow DOM editor advances to step 3 ('submit').
      editor.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          bubbles: true,
          composed: true,
          cancelable: true
        })
      )
      vi.advanceTimersByTime(200)

      // Now in step 'submit': hovering sendBtn paints it green.
      mouseOver(sendBtn)
      expect(sendBtn.classList.contains('_ai-picker-hover-good')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
