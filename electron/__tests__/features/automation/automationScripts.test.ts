import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateWaitForSubmitReadyScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'

describe('automationScripts', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  it('reuses cached input elements across repeated sends', async () => {
    document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button id="send" type="button">Send</button>
        `

    const script = generateAutoSendScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      'hello',
      false
    )
    const querySpy = vi.spyOn(document, 'querySelectorAll')

    const firstResult = await window.eval(script)
    const queryCountAfterFirstRun = querySpy.mock.calls.length
    const secondResult = await window.eval(script)

    expect(firstResult.success).toBe(true)
    expect(secondResult.success).toBe(true)
    expect(firstResult.diagnostics.input.strategy).toBe('direct')
    expect(secondResult.diagnostics.input.strategy).toBe('cache')
    expect(secondResult.diagnostics.input.cacheHits).toBeGreaterThan(0)
    expect(querySpy.mock.calls.length).toBe(queryCountAfterFirstRun)
  })

  it('invalidates cached selectors when the old element is detached', async () => {
    document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button id="send" type="button">Send</button>
        `

    const script = generateAutoSendScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      'hello',
      false
    )

    await window.eval(script)

    const previousInput = document.getElementById('input')
    previousInput?.remove()
    const replacementInput = document.createElement('textarea')
    replacementInput.id = 'input'
    document.body.prepend(replacementInput)

    const secondResult = await window.eval(script)

    expect(secondResult.success).toBe(true)
    expect(secondResult.diagnostics.input.cacheInvalidations).toBeGreaterThan(0)
    expect(secondResult.diagnostics.input.strategy).toBe('direct')
  })

  it('falls back to fingerprint resolution inside shadow DOM', async () => {
    const host = document.createElement('rich-textarea')
    host.id = 'composer-host'
    const shadowRoot = host.attachShadow({ mode: 'open' })
    const input = document.createElement('div')
    input.setAttribute('role', 'textbox')
    input.setAttribute('contenteditable', 'true')
    shadowRoot.appendChild(input)

    const sendButton = document.createElement('button')
    sendButton.setAttribute('aria-label', 'Send message')
    shadowRoot.appendChild(sendButton)

    document.body.appendChild(host)

    const focusScript = generateFocusScript({
      input: null,
      inputFingerprint: {
        tag: 'div',
        role: 'textbox',
        contentEditable: true,
        hostChain: [{ selector: '#composer-host', tag: 'rich-textarea', safeId: 'composer-host' }],
        localPath: ['div[role="textbox"]']
      }
    })

    const result = await window.eval(focusScript)

    expect(result.success).toBe(true)
    expect(result.diagnostics.input.strategy).toBe('fingerprint')
  })

  it('rejects ambiguous selector matches and surfaces re-pick requirement', async () => {
    document.body.innerHTML = `
            <textarea placeholder="Ask"></textarea>
            <textarea placeholder="Ask"></textarea>
            <button>Send</button>
        `

    const validateScript = generateValidateSelectorsScript({
      inputCandidates: ['textarea[placeholder="Ask"]'],
      button: 'button',
      submitMode: 'click',
      inputFingerprint: {
        tag: 'textarea',
        placeholder: 'Ask'
      },
      health: 'needs_repick'
    })

    const result = await window.eval(validateScript)

    expect(result.success).toBe(false)
    expect(result.error).toBe('selector_repick_required')
    expect(result.diagnostics.input.strategy).toBe('none')
  })

  it('keeps click-send enter fallback available when submit mode is enter_key', async () => {
    const input = document.createElement('textarea')
    document.body.appendChild(input)
    const keydownSpy = vi.fn()
    input.addEventListener('keydown', keydownSpy)

    const script = generateClickSendScript({
      input: 'textarea',
      submitMode: 'enter_key'
    })

    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(keydownSpy).toHaveBeenCalled()
  })

  it('waits for the send button to settle before reporting submit readiness', async () => {
    document.body.innerHTML = `
            <form id="composer">
                <textarea id="input"></textarea>
                <button id="send" type="button" disabled>Send</button>
            </form>
        `

    const sendButton = document.getElementById('send') as HTMLButtonElement
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
    const script = generateWaitForSubmitReadyScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      { timeoutMs: 4000, settleMs: 300, minimumWaitMs: 200 }
    )

    const execution = window.eval(script)

    setTimeout(() => {
      sendButton.disabled = false
      sendButton.removeAttribute('disabled')
      sendButton.setAttribute('data-upload-state', 'complete')
    }, 500)

    const result = await execution

    expect(result.success).toBe(true)
    expect(result.action).toBe('submit_ready')
    expect(result.diagnostics.submitMs).toBeGreaterThan(0)
  }, 10000)

  it('reports input_not_found when submit readiness input selector is missing', async () => {
    document.body.innerHTML = `<button id="send" type="button">Send</button>`

    const script = generateWaitForSubmitReadyScript(
      { input: '#missing-input', button: '#send', submitMode: 'click' },
      { timeoutMs: 300, settleMs: 50, minimumWaitMs: 50 }
    )

    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.error).toBe('input_not_found')
  }, 15000)

  it('reports button_not_found when click mode has no send button', async () => {
    document.body.innerHTML = `<textarea id="input"></textarea>`

    const script = generateWaitForSubmitReadyScript(
      { input: '#input', button: '#missing-send', submitMode: 'click' },
      { timeoutMs: 300, settleMs: 50, minimumWaitMs: 50 }
    )

    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.error).toBe('button_not_found')
  }, 15000)

  it('reports submit_not_ready when target exists but never becomes interactive', async () => {
    document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button id="send" type="button" disabled>Send</button>
        `
    const sendButton = document.getElementById('send') as HTMLButtonElement
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })

    const script = generateWaitForSubmitReadyScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      { timeoutMs: 600, settleMs: 100, minimumWaitMs: 100 }
    )

    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.error).toBe('submit_not_ready')
  }, 10000)

  describe('generated script structure', () => {
    it('builds auto-send script with core execution steps', () => {
      const script = generateAutoSendScript(
        { input: '[role="textbox"]', button: 'button[aria-label*="send" i]', submitMode: 'mixed' },
        'hello'
      )

      expect(script).toContain('setInputValue')
      expect(script).toContain('performSubmit')
      expect(script).toContain('createDiagnostics')
    })

    it('keeps common runtime helper injection for facade-generated scripts', () => {
      const focusScript = generateFocusScript({ input: '#input' })
      const validateScript = generateValidateSelectorsScript({
        input: '#input',
        button: '#send',
        submitMode: 'click'
      })

      expect(focusScript).toContain('__quizlabReaderAutomationCache')
      expect(focusScript).toContain('findElementByFingerprint')
      expect(validateScript).toContain("createDiagnostics('validate'")
    })
  })
})
