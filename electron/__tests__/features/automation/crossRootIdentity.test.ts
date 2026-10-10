/**
 * Cross-root target identity (PHASE 2 gate).
 *
 * Same selector / similar fingerprint in several DOM roots (main document,
 * same-origin iframe, open shadow roots). The picked root's element must win;
 * a high-scoring twin in another root must never be silently preferred; truly
 * indistinguishable cross-root twins must fail safe.
 *
 * X1: iframe twin, legacy fingerprint (no distinguishing attribute).
 *     The main document's twin must NOT be returned for an iframe pick.
 * X1b: same, but with a modern fingerprint (localPath). The iframe element
 *      must be resolved and acted on.
 * X2: duplicate ids across two open shadow roots, legacy fingerprint.
 *     Must fail safe instead of picking a root arbitrarily.
 * X2b: same, with a distinguishing fingerprint. The picked shadow root wins
 *      and the text lands in the EXPECTED element.
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

describe('cross-root target identity', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  it('X1: legacy iframe pick is never resolved to the main-document twin', async () => {
    document.body.innerHTML = `<div class="layout"><input id="msg" type="text" /></div>`
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument
    if (!iframeDoc || !iframeDoc.body) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }
    iframeDoc.body.innerHTML = `<section><input id="msg" type="text" /></section>`
    document.body.appendChild(makeInteractiveButton())

    // Legacy fingerprint: no attribute distinguishes the iframe twin.
    const script = generateValidateSelectorsScript({
      input: '#msg',
      button: 'button[aria-label="Send message"]',
      submitMode: 'click',
      inputFingerprint: { tag: 'input', type: 'text', safeId: 'msg' }
    })
    const result = await window.eval(script)

    // Either root would be a guess: fail safe, never stage the wrong root.
    expect(result.success).toBe(false)
    expect(result.diagnostics.input.strategy).toBe('none')
  }, 20000)

  it('X1b: modern iframe pick resolves AND acts in the picked iframe', async () => {
    document.body.innerHTML = `<div class="layout"><input id="msg" type="text" /></div>`
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument
    if (!iframeDoc || !iframeDoc.body) {
      throw new Error('Test environment must expose iframe.contentDocument')
    }
    iframeDoc.body.innerHTML = `<section><input id="msg" type="text" /></section>`
    const frameInput = iframeDoc.getElementById('msg') as HTMLInputElement
    document.body.appendChild(makeInteractiveButton())

    const script = generateAutoSendScript(
      {
        input: '#msg',
        button: 'button[aria-label="Send message"]',
        submitMode: 'enter_key',
        inputFingerprint: {
          tag: 'input',
          type: 'text',
          safeId: 'msg',
          localPath: ['html', 'body', 'section', 'input']
        }
      },
      'frame hello',
      false
    )
    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(frameInput.value).toContain('frame hello')
    expect((document.getElementById('msg') as HTMLInputElement).value).not.toContain('frame hello')
  }, 20000)

  it('X2: duplicate ids across shadow roots fail safe with a legacy fingerprint', async () => {
    const buildHost = (id: string) => {
      const host = document.createElement('div')
      host.id = id
      const root = host.attachShadow({ mode: 'open' })
      root.innerHTML = `<div class="wrap"><input id="x" type="text" /></div>`
      document.body.appendChild(host)
      return root
    }
    buildHost('host-a')
    buildHost('host-b')
    document.body.appendChild(makeInteractiveButton())

    const script = generateValidateSelectorsScript({
      input: '#x',
      button: 'button[aria-label="Send message"]',
      submitMode: 'click',
      inputFingerprint: { tag: 'input', type: 'text', safeId: 'x' }
    })
    const result = await window.eval(script)

    expect(result.success).toBe(false)
    expect(result.diagnostics.input.strategy).toBe('none')
  }, 20000)

  it('X2b: distinguishing fingerprint resolves the picked shadow root and acts there', async () => {
    const buildHost = (id: string, placeholder: string) => {
      const host = document.createElement('div')
      host.id = id
      const root = host.attachShadow({ mode: 'open' })
      root.innerHTML = `<div class="wrap"><input id="x" type="text" placeholder="${placeholder}" /></div>`
      document.body.appendChild(host)
      return root.querySelector('input') as HTMLInputElement
    }
    const inputA = buildHost('host-a', 'Alpha')
    const inputB = buildHost('host-b', 'Beta')
    document.body.appendChild(makeInteractiveButton())

    const script = generateAutoSendScript(
      {
        input: '#x',
        button: 'button[aria-label="Send message"]',
        submitMode: 'enter_key',
        inputFingerprint: {
          tag: 'input',
          type: 'text',
          safeId: 'x',
          placeholder: 'Beta',
          hostChain: [{ selector: '#host-b', tag: 'div', safeId: 'host-b' }],
          localPath: ['html', 'div.wrap', 'input']
        }
      },
      'shadow hello',
      false
    )
    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(inputB.value).toContain('shadow hello')
    expect(inputA.value).not.toContain('shadow hello')
  }, 20000)
})
