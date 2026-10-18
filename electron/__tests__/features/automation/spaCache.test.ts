import { generateAutoSendScript } from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it } from 'vitest'

/**
 * SPA-aware cache invalidation testleri.
 * `selectorEngine` template'i `pushState`/`replaceState`/`popstate` üzerinden
 * SPA navigasyonu tespit edip cache'i soft-invalidate etmelidir.
 */
describe('SPA-aware cache invalidation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
    delete (window as typeof window & { __quizlabSpaProbeInstalled?: boolean })
      .__quizlabSpaProbeInstalled
  })

  it.each(['pushState', 'replaceState'] as const)(
    'clears the cache on history.%s (SPA route change)',
    async (method) => {
      document.body.innerHTML = `<textarea id="input"></textarea><button id="send">Send</button>`

      const script = generateAutoSendScript(
        { input: '#input', button: '#send', submitMode: 'click' },
        'first',
        false
      )

      const first = await window.eval(script)
      expect(first.success).toBe(true)
      expect(first.diagnostics.input.strategy).toBe('direct')

      // Same script, second call: should hit cache
      const second = await window.eval(script)
      expect(second.success).toBe(true)
      expect(second.diagnostics.input.strategy).toBe('cache')

      // Simulate SPA navigation (e.g. ChatGPT changing URL)
      if (method === 'pushState') {
        window.history.pushState({}, '', '/new-route')
      } else {
        window.history.replaceState({}, '', '/replaced')
      }

      // Give the dispatched event a tick to propagate
      await new Promise((r) => setTimeout(r, 5))

      // Third call: cache should be cleared, falls back to direct match
      const third = await window.eval(script)
      expect(third.success).toBe(true)
      expect(third.diagnostics.input.strategy).not.toBe('cache')
    }
  )

  it('installs the SPA probe only once', async () => {
    document.body.innerHTML = `<textarea id="input"></textarea><button id="send">Send</button>`
    const script = generateAutoSendScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      'first',
      false
    )

    await window.eval(script)
    const probeStateAfterFirst = (
      window as typeof window & { __quizlabSpaProbeInstalled?: boolean }
    ).__quizlabSpaProbeInstalled
    expect(probeStateAfterFirst).toBe(true)

    // Save current pushState reference
    const pushStateRef = window.history.pushState
    await window.eval(script)
    // Probe should not have replaced pushState twice
    expect(window.history.pushState).toBe(pushStateRef)
  })
})
