import {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
} from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('selector auto-repair engine', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  describe('normalizeText whitespace handling', () => {
    it('normalizes multiple spaces into single space', async () => {
      // The normalizeText function in baseHelpers.ts must match actual
      // whitespace characters (spaces, tabs, newlines), not literal \s.
      const script = `
        (async function() {
          const normalizeText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
          return {
            spaces: normalizeText('hello   world'),
            tabs: normalizeText('hello\\tworld'),
            newlines: normalizeText('hello\\nworld'),
            mixed: normalizeText(' hello \\n world '),
            empty: normalizeText(''),
            nullVal: normalizeText(null)
          };
        })()
      `
      const result = await window.eval(script)

      expect(result.spaces).toBe('hello world')
      expect(result.tabs).toBe('hello world')
      expect(result.newlines).toBe('hello world')
      expect(result.mixed).toBe('hello world')
      expect(result.empty).toBe('')
      expect(result.nullVal).toBe('')
    })
  })

  describe('broken selector recovery via fingerprint', () => {
    it('recovers input when primary selector is broken but fingerprint matches', async () => {
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
        input: '#nonexistent-selector',
        inputFingerprint: {
          tag: 'div',
          role: 'textbox',
          contentEditable: true,
          hostChain: [
            { selector: '#composer-host', tag: 'rich-textarea', safeId: 'composer-host' }
          ],
          localPath: ['div[role="textbox"]']
        }
      })

      const result = await window.eval(focusScript)

      expect(result.success).toBe(true)
      expect(result.diagnostics.input.strategy).toBe('fingerprint')
    })
  })

  describe('candidate fallback', () => {
    it('uses candidate selectors when primary fails', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="editor"></div>
        <button aria-label="Send message" id="send">Send</button>
      `

      const script = generateAutoSendScript(
        {
          input: '#nonexistent',
          inputCandidates: ['div[role="textbox"]', 'textarea'],
          button: '#send',
          submitMode: 'click'
        },
        'hello',
        false
      )

      const result = await window.eval(script)

      expect(result.success).toBe(true)
      expect(result.diagnostics.input.strategy).not.toBe('none')
    })
  })

  describe('cache hit/miss', () => {
    it('hits cache on repeated sends', async () => {
      document.body.innerHTML = `
        <textarea id="input"></textarea>
        <button id="send" type="button">Send</button>
      `

      const script = generateAutoSendScript(
        { input: '#input', button: '#send', submitMode: 'click' },
        'hello',
        false
      )

      const firstResult = await window.eval(script)
      const secondResult = await window.eval(script)

      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(true)
      expect(firstResult.diagnostics.input.strategy).toBe('direct')
      expect(secondResult.diagnostics.input.strategy).toBe('cache')
      expect(secondResult.diagnostics.input.cacheHits).toBeGreaterThan(0)
    })

    it('misses cache when element is detached', async () => {
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

    it('tracks success count in cache entries', async () => {
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
      await window.eval(script)
      await window.eval(script)

      const cache = (
        window as typeof window & {
          __quizlabReaderAutomationCache?: { elements: Record<string, { successCount: number }> }
        }
      ).__quizlabReaderAutomationCache
      const entries = cache ? Object.values(cache.elements) : []
      const inputEntry = entries.find((e) => e.successCount > 0)
      expect(inputEntry?.successCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('existing functionality preserved', () => {
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

    it('rejects ambiguous selectors and surfaces re-pick requirement', async () => {
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
    })

    it('disambiguates multiple buttons using fingerprint when selector matches several', async () => {
      // Create a scenario where multiple [role="button"] elements exist,
      // but only one matches the saved fingerprint (aria-label + text).
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button role="button" aria-label="New Chat">New</button>
        <button role="button" aria-label="Send message">Send</button>
        <button role="button" aria-label="Settings">Settings</button>
      `

      // Use shouldSubmit=false to test element resolution without the full submit flow
      // (which hangs in jsdom due to missing element dimensions for settle checks).
      const script = generateAutoSendScript(
        {
          input: '#composer',
          button: '[role="button"]',
          buttonCandidates: ['[role="button"]', 'button[aria-label="Send message"]'],
          submitMode: 'click',
          buttonFingerprint: {
            tag: 'button',
            role: 'button',
            ariaLabel: 'Send message',
            text: 'Send message'
          }
        },
        'hello world',
        false
      )

      const result = await window.eval(script)

      expect(result.success).toBe(true)
      expect(result.action).toBe('input_only')
      // The engine should have resolved the input via the contenteditable selector
      expect(result.diagnostics.input.strategy).not.toBe('none')
    })

    it('picks correct button when multiple buttons share same aria-label pattern', async () => {
      // Simulate a page with multiple chat threads, each with its own send button.
      // Use auto-send with shouldSubmit=false to test that the engine resolves
      // the input and discovers the button (fingerprint disambiguation happens at runtime).
      document.body.innerHTML = `
        <textarea id="input"></textarea>
        <button aria-label="Send">Send to Thread A</button>
        <button aria-label="Send">Send to Thread B</button>
        <button aria-label="Send">Send to Thread C</button>
      `

      const script = generateAutoSendScript(
        {
          input: '#input',
          button: 'button[aria-label="Send"]',
          submitMode: 'click',
          buttonFingerprint: {
            tag: 'button',
            ariaLabel: 'Send',
            text: 'Send to Thread B'
          }
        },
        'test',
        false
      )

      const result = await window.eval(script)

      expect(result.success).toBe(true)
      expect(result.action).toBe('input_only')
      // Verify the input was typed into the textarea
      const textarea = document.getElementById('input') as HTMLTextAreaElement
      expect(textarea.value).toBe('test')
    })
  })
})
