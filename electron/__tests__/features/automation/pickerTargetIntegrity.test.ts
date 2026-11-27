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

  function withElementFromPoint(
    hit: (() => Element | null) | null,
    run: () => void | Promise<void>
  ) {
    const doc = document as unknown as Record<string, unknown>
    const original = doc.elementFromPoint as ((x: number, y: number) => Element | null) | undefined
    doc.elementFromPoint = hit || (() => null)
    try {
      return run()
    } finally {
      if (original) doc.elementFromPoint = original
      else delete doc.elementFromPoint
    }
  }

  function pointerClick(el: Element, x = 24, y = 24) {
    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        cancelable: true,
        clientX: x,
        clientY: y
      })
    )
  }

  function pointerOver(el: Element, x = 24, y = 24) {
    el.dispatchEvent(
      new MouseEvent('mouseover', {
        bubbles: true,
        composed: true,
        cancelable: true,
        clientX: x,
        clientY: y
      })
    )
  }

  // A composer nested in a clickable shell (role="button" card, <a> wrapper).
  // The old normalization promoted the shell first and then refused to climb
  // back down to the textbox because it sat "inside a button", so the input
  // step could never be completed on such a site — every click flashed red.
  it('T17: a text box inside a clickable ancestor is still picked as the input', () => {
    eval(generatePickerScript())

    const shell = document.createElement('div')
    shell.setAttribute('role', 'button')
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    editor.setAttribute('role', 'textbox')
    shell.appendChild(editor)
    document.body.appendChild(shell)

    mouseOver(editor)
    expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)

    click(editor)
    expect(document.getElementById('_ai_picker_next_btn')).not.toBeNull()
    expect(document.querySelector('._ai-picker-selected')).toBe(editor)
    expect(shell.classList.contains('_ai-picker-selected')).toBe(false)
  })

  it('T17b: picking a contenteditable focuses it and collapses the caret to the end', () => {
    eval(generatePickerScript())

    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    editor.textContent = 'draft text'
    document.body.appendChild(editor)

    click(editor)

    expect(document.activeElement).toBe(editor)
    const selection = window.getSelection()
    expect(selection?.rangeCount).toBe(1)
    expect(selection?.getRangeAt(0)?.collapsed).toBe(true)
  })

  // role="textbox" on a non-editable wrapper: automation's value setters would
  // write a property on a plain <div> and the text would never reach the
  // editor. The picker must persist the control that accepts text.
  it('T18: a role=textbox wrapper resolves to the inner control', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())

      const wrapper = document.createElement('div')
      wrapper.setAttribute('role', 'textbox')
      const area = document.createElement('textarea')
      area.setAttribute('placeholder', 'Ask anything')
      wrapper.appendChild(area)
      document.body.appendChild(wrapper)

      click(wrapper)
      expect(document.querySelector('._ai-picker-selected')).toBe(area)

      const sendBtn = document.createElement('button')
      sendBtn.setAttribute('aria-label', 'Send message')
      document.body.appendChild(sendBtn)
      document
        .getElementById('_ai_picker_next_btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      click(sendBtn)
      vi.advanceTimersByTime(1000)

      const result = (window as PickerWindow)._aiPickerResult as unknown as {
        inputFingerprint?: { tag?: string }
      }
      expect(result.inputFingerprint?.tag).toBe('textarea')
    } finally {
      vi.useRealTimers()
    }
  })

  // Sites that hydrate or re-render the composer in response to a click can
  // remove the clicked node while the event is still propagating. Rejecting the
  // now-detached target left the user with a red flash on a node that is no
  // longer on the page.
  it('T19: a click whose target was removed mid-event is re-resolved at the pointer', () => {
    const editor = document.createElement('textarea')
    document.body.appendChild(editor)
    const transient = document.createElement('div')
    document.body.appendChild(transient)

    // Registered BEFORE the picker so this capture listener runs first and the
    // picker sees a path whose first element is already detached.
    const removeClicked = (e: Event) => {
      if (e.target === transient) transient.remove()
    }
    document.addEventListener('click', removeClicked, true)
    try {
      eval(generatePickerScript())

      withElementFromPoint(
        () => editor,
        () => {
          pointerClick(transient)
        }
      )
    } finally {
      document.removeEventListener('click', removeClicked, true)
    }

    expect(document.querySelector('._ai-picker-selected')).toBe(editor)
  })

  // 0a9d7bde blanked the hover on every scroll. Scrolling to reach a composer
  // then made the picker look dead until the mouse moved again.
  it('T20: scrolling keeps the hover when the pointer is still over the same element', () => {
    eval(generatePickerScript())

    const editor = document.createElement('textarea')
    document.body.appendChild(editor)
    const labelBox = document.querySelectorAll<HTMLElement>('[data-ai-picker-ui="true"]')[1]

    withElementFromPoint(
      () => editor,
      () => {
        pointerOver(editor, 40, 40)
        expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)
        expect(labelBox?.style.display).toBe('block')

        document.dispatchEvent(new Event('scroll'))
        expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)
        expect(labelBox?.style.display).toBe('block')
      }
    )

    // Pointer no longer over the element: the stale outline must still clear.
    withElementFromPoint(
      () => null,
      () => {
        document.dispatchEvent(new Event('scroll'))
        expect(editor.classList.contains('_ai-picker-hover-good')).toBe(false)
        expect(labelBox?.style.display).toBe('none')
      }
    )
  })

  // Editors that implement their own key pipeline can suppress or re-target the
  // plain input event. keyup/compositionend/paste are the same signal through
  // other channels and must advance the typing step too.
  it('T21: keyup-only typing advances to the send step', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())

      const editor = document.createElement('textarea')
      document.body.appendChild(editor)
      const sendBtn = document.createElement('button')
      sendBtn.setAttribute('aria-label', 'Send message')
      document.body.appendChild(sendBtn)

      click(editor)
      editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true, composed: true }))
      vi.advanceTimersByTime(300)

      // In 'submit' only, hovering the button paints it green.
      mouseOver(sendBtn)
      expect(sendBtn.classList.contains('_ai-picker-hover-good')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('T22: the emitted script keeps the F-key regex backslash through the template literal', () => {
    const script = generatePickerScript()
    expect(script).toContain('/^F\\d+$/i')
  })

  // Sites can act on pointer/mouse down or up (ChatGPT's composer submits the
  // draft on the pointer sequence even when the click's default is prevented).
  // Picking the send button must not send anything.
  it('T24: control-targeted pointer/mouse events are swallowed, text-box ones are not', () => {
    eval(generatePickerScript())

    const input = document.createElement('textarea')
    document.body.appendChild(input)
    const sendBtn = document.createElement('button')
    sendBtn.setAttribute('aria-label', 'Send message')
    document.body.appendChild(sendBtn)

    let controlEvents = 0
    let inputEvents = 0
    const controlListener = () => {
      controlEvents += 1
    }
    const inputListener = () => {
      inputEvents += 1
    }
    sendBtn.addEventListener('pointerdown', controlListener)
    sendBtn.addEventListener('mousedown', controlListener)
    sendBtn.addEventListener('pointerup', controlListener)
    sendBtn.addEventListener('mouseup', controlListener)
    input.addEventListener('pointerdown', inputListener)
    input.addEventListener('mousedown', inputListener)

    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      sendBtn.dispatchEvent(
        new MouseEvent(type, { bubbles: true, composed: true, cancelable: true })
      )
    }
    expect(controlEvents).toBe(0)

    // The native focus/caret path of a text box must stay alive.
    for (const type of ['pointerdown', 'mousedown']) {
      input.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, cancelable: true }))
    }
    expect(inputEvents).toBe(2)
  })

  // A host whose React root is <body> can delete the picker chrome without
  // replacing body. The <html> observer cannot see that; the step panel is the
  // only step feedback the user has.
  it('T25: picker chrome removed from <body> is re-attached', async () => {
    eval(generatePickerScript())

    const boxes = () => document.querySelectorAll('[data-ai-picker-ui="true"]')
    expect(boxes().length).toBe(2)

    boxes()[0]?.remove()
    boxes()[0]?.remove()
    expect(boxes().length).toBe(0)

    // Any later body mutation must restore both boxes.
    const noise = document.createElement('div')
    document.body.appendChild(noise)

    await vi.waitFor(() => expect(boxes().length).toBe(2))
    expect(boxes()[0]?.textContent).toContain('Step 1 / 3')
  })

  // Focus-time hydration can replace the picked composer node. Containment can
  // never match the detached one again, so typing would be invisible and step 2
  // would never advance.
  it('T26: typing into a replaced composer re-binds it and advances to the send step', () => {
    vi.useFakeTimers()
    try {
      eval(generatePickerScript())

      const first = document.createElement('div')
      first.setAttribute('contenteditable', 'true')
      document.body.appendChild(first)
      const sendBtn = document.createElement('button')
      sendBtn.setAttribute('aria-label', 'Send message')
      document.body.appendChild(sendBtn)

      click(first)
      expect(document.getElementById('_ai_picker_next_btn')).not.toBeNull()

      first.remove()
      const replacement = document.createElement('div')
      replacement.setAttribute('contenteditable', 'true')
      document.body.appendChild(replacement)

      replacement.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      vi.advanceTimersByTime(300)

      expect(document.querySelector('._ai-picker-selected')).toBe(replacement)
      mouseOver(sendBtn)
      expect(sendBtn.classList.contains('_ai-picker-hover-good')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  // infoBox/labelBox use pointer-events:none, so a click on their visible
  // surface is delivered to the page element underneath. The picker must
  // swallow it instead of classifying (and red-flashing) the hidden element.
  it('T23: clicking the info panel surface does not reject the element beneath it', () => {
    eval(generatePickerScript())

    const beneath = document.createElement('span')
    beneath.textContent = 'page content under the panel'
    document.body.appendChild(beneath)

    const infoBox = document.querySelectorAll<HTMLElement>('[data-ai-picker-ui="true"]')[0]
    infoBox.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 320,
        bottom: 200,
        width: 320,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect

    pointerClick(beneath, 100, 100)

    expect(beneath.style.boxShadow).toBe('')
    expect(document.querySelector('._ai-picker-selected')).toBeNull()
    expect(document.getElementById('_ai_picker_next_btn')).toBeNull()
  })

  function stubRect(el: Element, x: number, y: number, width: number, height: number) {
    el.getBoundingClientRect = () =>
      ({
        x,
        y,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        width,
        height,
        toJSON: () => ({})
      }) as DOMRect
  }

  // A composer's rounded bar is mostly padding: the editable itself is a thin
  // strip in the middle. Clicking the visible box but missing that strip used to
  // be rejected as a container, which reads as "the click does nothing".
  it('T27: clicking the composer shell resolves to the editable inside it', () => {
    eval(generatePickerScript())

    const shell = document.createElement('div')
    shell.setAttribute('role', 'presentation')
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    editor.setAttribute('role', 'textbox')
    shell.appendChild(editor)
    document.body.appendChild(shell)
    stubRect(shell, 0, 0, 200, 48)
    stubRect(editor, 10, 12, 180, 24)

    // Hover must paint the same element the click will persist.
    mouseOver(shell)
    expect(editor.classList.contains('_ai-picker-hover-good')).toBe(true)

    click(shell)
    expect(document.getElementById('_ai_picker_next_btn')).not.toBeNull()
    expect(document.querySelector('._ai-picker-selected')).toBe(editor)
    expect(shell.classList.contains('_ai-picker-selected')).toBe(false)
  })

  it('T27b: a page-sized container that merely contains a text box is not treated as its shell', () => {
    eval(generatePickerScript())

    const section = document.createElement('section')
    const area = document.createElement('textarea')
    section.appendChild(area)
    document.body.appendChild(section)
    stubRect(section, 0, 0, 1200, 800)
    stubRect(area, 20, 20, 300, 40)

    click(section)
    expect(document.querySelector('._ai-picker-selected')).toBeNull()
    expect(document.getElementById('_ai_picker_next_btn')).toBeNull()
  })
})
