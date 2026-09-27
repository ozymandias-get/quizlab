import {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
} from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('skips an invalid selector and continues with valid candidates', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <button type="button">Send</button>
    `

    const script = generateAutoSendScript(
      {
        input: null,
        inputCandidates: ['[aria-label="broken', 'textarea'],
        button: 'button',
        submitMode: 'click'
      },
      'hello',
      false
    )

    const result = await window.eval(script)
    expect(result.success).toBe(true)
    expect(result.diagnostics.input.matchedSelector).toBe('textarea')
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
    expect(result.diagnostics.input.strategy).not.toBe('cache')
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

  it('cancels a wait when the guest navigation aborts the run', async () => {
    const script = generateWaitForSubmitReadyScript(
      { input: '#missing-input', button: '#missing-send', submitMode: 'click' },
      { timeoutMs: 1500, settleMs: 50, minimumWaitMs: 50 }
    )

    const execution = window.eval(script)
    setTimeout(() => {
      const automationWindow = window as Window & {
        __quizlabAbortController?: AbortController
      }
      automationWindow.__quizlabAbortController?.abort()
    }, 50)

    const result = await execution
    expect(result.success).toBe(false)
    expect(result.diagnostics.totalMs).toBeLessThan(1000)
  })

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

  // A generic "still processing" error gives no way to tell a genuinely slow
  // upload from a stale selector or a paste that attached nothing. These
  // fields are what make the difference diagnosable from the log alone.
  describe('submit_not_ready diagnostics', () => {
    function prepareDisabledButton() {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button" disabled>Send</button>
          `
      const sendButton = document.getElementById('send') as HTMLButtonElement
      Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
      Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
      return sendButton
    }

    it('names the disabled button and reports the wait budget', async () => {
      prepareDisabledButton()

      const result = await window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 500, settleMs: 100, minimumWaitMs: 100 }
        )
      )

      expect(result.error).toBe('submit_not_ready')
      expect(result.notReadyTarget).toBe('button')
      expect(result.notReadyReason).toMatch(/disabled/)
      expect(result.budgetMs).toBe(500)
      expect(result.minimumWaitMs).toBe(100)
      expect(result.waitedMs).toBeGreaterThan(0)
    }, 10000)

    it('reports that the target was never ready when the button stays disabled', async () => {
      prepareDisabledButton()

      const result = await window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 400, settleMs: 80, minimumWaitMs: 80 }
        )
      )

      expect(result.everReady).toBe(false)
    }, 10000)

    it('reports everReady when the button briefly enabled then re-disabled', async () => {
      const sendButton = prepareDisabledButton()

      const execution = window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 900, settleMs: 900, minimumWaitMs: 50 }
        )
      )
      setTimeout(() => {
        sendButton.disabled = false
        sendButton.removeAttribute('disabled')
      }, 150)

      const result = await execution

      expect(result.error).toBe('submit_not_ready')
      // The stale-button flap is a different failure from "never enabled".
      expect(result.everReady).toBe(true)
    }, 10000)

    it('reports aria-disabled distinctly from the disabled property', async () => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button" aria-disabled="true">Send</button>
          `
      const sendButton = document.getElementById('send') as HTMLButtonElement
      Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
      Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })

      const result = await window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 300, settleMs: 60, minimumWaitMs: 60 }
        )
      )

      expect(result.notReadyReason).toBe('aria_disabled')
    }, 10000)

    it('reports a hidden match instead of claiming the target is disabled', async () => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button" style="display:none">Send</button>
          `
      const sendButton = document.getElementById('send') as HTMLButtonElement
      // jsdom performs no layout, so size must be stubbed for visibility
      // checks to be about `display` rather than `zero_size`.
      Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
      Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })

      const result = await window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 300, settleMs: 60, minimumWaitMs: 60 }
        )
      )

      expect(result.notReadyReason).toBe('display_none')
    }, 10000)

    it('reports zero_size for a matched but unrendered element', async () => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button">Send</button>
          `

      const result = await window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 300, settleMs: 60, minimumWaitMs: 60 }
        )
      )

      expect(result.notReadyReason).toBe('zero_size')
    }, 10000)
  })

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

    it('prevents script injection via malicious text payloads', () => {
      // SECURITY: JSON.stringify escapes all special characters so they
      // remain inside the generated string literal as data, not as code.
      // The definitive proof is that the generated script parses as valid
      // JavaScript without throwing — meaning no injection characters
      // "broke out" of the string literal.
      const config = {
        input: '#input',
        button: '#send',
        submitMode: 'click' as const
      }

      const payloads: string[] = [
        "'; alert(1);//",
        "'; alert(1);//",
        '${1+1}',
        '`backtick`',
        '"); require("child_process").execSync("evil");//',
        '{{constructor.constructor("return 1")()}}',
        '\\u005c\\u0027',
        'new Function("return 1")()'
      ]

      for (const payload of payloads) {
        const script = generateAutoSendScript(config, payload, false)
        // new Function throws SyntaxError if the escaped string
        // broke out and produced invalid JavaScript.
        expect(() => new Function(script), `Payload: ${JSON.stringify(payload)}`).not.toThrow()
      }
    })
  })
})
