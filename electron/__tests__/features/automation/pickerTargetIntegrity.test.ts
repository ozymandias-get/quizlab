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
  generateLocatorBundle
} from '@electron/features/automation/lib/dom/pickerDomRuntime'

import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    expect(button.style.boxShadow).toContain('#ef4444')
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
})
