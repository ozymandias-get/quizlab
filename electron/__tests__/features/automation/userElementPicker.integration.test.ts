import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateAutoSendScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

type PickerWindow = Window & {
  _aiPickerResult?: Record<string, unknown> | null
  _aiPickerCleanup?: () => void
}

describe('userElementPicker integration', () => {
  beforeEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  afterEach(() => {
    const pickerWindow = window as PickerWindow
    if (pickerWindow._aiPickerCleanup) {
      try {
        pickerWindow._aiPickerCleanup()
      } catch {
        // no-op
      }
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

    await new Promise((resolve) => setTimeout(resolve, 900))

    const pickerResult = (window as PickerWindow)._aiPickerResult
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

    await new Promise((resolve) => setTimeout(resolve, 900))

    const pickerResult = (window as PickerWindow)._aiPickerResult
    expect(pickerResult).toBeTruthy()
    expect(pickerResult).toEqual(
      expect.objectContaining({
        version: 2,
        inputFingerprint: expect.any(Object),
        buttonFingerprint: expect.any(Object)
      })
    )
  }, 10000)
})
