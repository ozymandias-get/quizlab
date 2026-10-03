/**
 * Regression tests for the injected human-typing loop.
 *
 * humanType() emits one character per `typingSpeed` ms. The IPC layer accepts up
 * to 100 KB of prompt text, so without cooperative cancellation a single large
 * prompt kept the injected promise pending for tens of minutes — and because
 * queueForWebview chains later sends behind it, that webview's send pipeline was
 * wedged for the rest of the session with no way to recover.
 */
import { generateAutoSendScript } from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const ABORT_FLAG = '__quizlabAbortController'

function makeConfig() {
  return {
    input: '#input',
    button: '#send',
    submitMode: 'click' as const
  }
}

describe('humanType cancellation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <textarea id="input"></textarea>
      <button id="send" type="button">Send</button>
    `
    delete (window as unknown as Record<string, unknown>)[ABORT_FLAG]
    delete (window as unknown as Record<string, unknown>).__quizlabReaderAutomationCache
    delete (window as unknown as Record<string, unknown>).__quizlabSpaProbeInstalled
    delete (window as unknown as Record<string, unknown>).__quizlabSpaNavListenerInstalled
  })

  it('stops typing when the abort controller fires', async () => {
    const controller = new AbortController()
    ;(window as unknown as Record<string, unknown>)[ABORT_FLAG] = controller

    // 120 characters at 1000ms each would need ~2 minutes without cancellation.
    const prompt = 'x'.repeat(120)
    const script = generateAutoSendScript(makeConfig(), prompt, false, false, 'typing', 1000)

    const started = Date.now()
    const execution = window.eval(script)

    setTimeout(() => controller.abort(), 60)

    const result = await execution
    const elapsed = Date.now() - started

    // The script must settle promptly rather than typing all 120 characters.
    expect(elapsed).toBeLessThan(10_000)

    const textarea = document.getElementById('input') as HTMLTextAreaElement
    expect(textarea.value.length).toBeLessThan(prompt.length)
    expect(result).toBeTruthy()
  })

  it('registers the SPA navigation listener only once across injections', async () => {
    // Every injected script re-evaluates the engine preamble. An unguarded
    // addEventListener with a fresh closure identity could never be removed, so
    // each send left another listener that reset the whole selector cache on
    // every pushState.
    const addSpy = vi.spyOn(window, 'addEventListener')
    const countSpaNavListeners = () =>
      addSpy.mock.calls.filter(([type]) => type === '__quizlabSpaNav').length

    const script = generateAutoSendScript(makeConfig(), 'hello', false)

    await window.eval(script)
    const afterFirst = countSpaNavListeners()
    await window.eval(script)
    await window.eval(script)

    expect(afterFirst).toBe(1)
    expect(countSpaNavListeners()).toBe(1)
    addSpy.mockRestore()
  })

  it('still types the whole prompt when nothing aborts', async () => {
    const controller = new AbortController()
    ;(window as unknown as Record<string, unknown>)[ABORT_FLAG] = controller

    const prompt = 'hello'
    const script = generateAutoSendScript(makeConfig(), prompt, false, false, 'typing', 1)

    const result = await window.eval(script)

    expect(result.success).toBe(true)
    const textarea = document.getElementById('input') as HTMLTextAreaElement
    expect(textarea.value).toBe(prompt)
  })
})
