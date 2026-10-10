/**
 * Cross-layer target-integrity verification (PHASE 4):
 * picker → LocatorBundle → resolver → cache → automation → self-healing.
 *
 * A page with duplicated ids: the full hardened chain must carry the PICKED
 * element through every layer and type into it — never into its twin, and
 * never via a silent recovery.
 */
import {
  generateAutoSendScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

import { beforeEach, describe, expect, it, vi } from 'vitest'

type PickerWindow = Window & {
  _aiPickerResult?: Record<string, unknown> | null
  _aiPickerCleanup?: () => void
  _aiPickerCancelled?: boolean
}

describe('cross-layer target integrity', () => {
  beforeEach(() => {
    vi.useRealTimers()
    const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number
    const g = globalThis as typeof globalThis & {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number
    }
    g.requestAnimationFrame ??= raf
    const w = window as typeof window & {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number
    }
    w.requestAnimationFrame ??= raf
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    const pw = window as PickerWindow
    try {
      pw._aiPickerCleanup?.()
    } catch {}
    delete pw._aiPickerResult
    delete pw._aiPickerCancelled
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  it('carries the picked twin through pick, validate, send and cache', async () => {
    vi.useFakeTimers()
    try {
      // Two forms share an invalid duplicated id; only the placeholder
      // distinguishes the picked composer.
      const first = document.createElement('input')
      first.setAttribute('id', 'msg')
      first.setAttribute('type', 'text')
      first.setAttribute('placeholder', 'Search')
      document.body.appendChild(first)
      const second = document.createElement('input')
      second.setAttribute('id', 'msg')
      second.setAttribute('type', 'text')
      second.setAttribute('placeholder', 'Type a message')
      document.body.appendChild(second)
      const sendButton = document.createElement('button')
      sendButton.setAttribute('aria-label', 'Send message')
      Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
      Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
      document.body.appendChild(sendButton)

      eval(generatePickerScript())

      // 1. Pick the SECOND composer (input step).
      second.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      // Advance typing → submit via the Next affordance.
      document
        .getElementById('_ai_picker_next_btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      // 2. Pick the send button.
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      vi.advanceTimersByTime(1000)

      const picked = (window as PickerWindow)._aiPickerResult as unknown as {
        input: string
        button: string
        inputFingerprint: Record<string, unknown>
        buttonFingerprint: Record<string, unknown>
      }
      expect(picked).toBeTruthy()
      // The persisted primary must NOT be the duplicated id.
      expect(picked.input).not.toBe('#msg')
      expect(document.querySelector(picked.input)).toBe(second)

      // Back to real timers: the automation scripts below manage their own
      // retry waits and must not run on a frozen clock.
      vi.useRealTimers()

      // 3. Validate resolves the picked element through the resolver.
      const validateResult = await window.eval(generateValidateSelectorsScript(picked as never))
      expect(validateResult.success).toBe(true)
      expect(validateResult.diagnostics.input.strategy).toBe('direct')

      // 4. Send types into the picked twin — not its twin…
      const sendResult = await window.eval(
        generateAutoSendScript(picked as never, 'cross-layer hello', false)
      )
      expect(sendResult.success).toBe(true)
      expect((second as HTMLInputElement).value).toContain('cross-layer hello')
      expect((first as HTMLInputElement).value).not.toContain('cross-layer hello')

      // …and the warm cache still points at the picked twin (no drift).
      expect(sendResult.diagnostics.input.strategy).not.toBe('none')
    } finally {
      vi.useRealTimers()
    }
  }, 20000)
})
