import { generateAutoSendScript } from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('clears cache on history.pushState (SPA route change)', async () => {
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

    // Simulate SPA navigation (e.g. ChatGPT changing URL via pushState)
    window.history.pushState({}, '', '/new-route')

    // Give the dispatched event a tick to propagate
    await new Promise((r) => setTimeout(r, 5))

    // Third call: cache should be cleared, falls back to direct match
    const third = await window.eval(script)
    expect(third.success).toBe(true)
    // After SPA nav, cache is invalidated; strategy should be 'direct' (or any non-cache)
    expect(third.diagnostics.input.strategy).not.toBe('cache')
  })

  it('clears cache on history.replaceState', async () => {
    document.body.innerHTML = `<textarea id="input"></textarea><button id="send">Send</button>`
    const script = generateAutoSendScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      'first',
      false
    )

    await window.eval(script)
    await window.eval(script) // warm cache

    window.history.replaceState({}, '', '/replaced')
    await new Promise((r) => setTimeout(r, 5))

    const after = await window.eval(script)
    expect(after.success).toBe(true)
    expect(after.diagnostics.input.strategy).not.toBe('cache')
  })

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

  it('caches stale-but-still-valid element across SPA navs (soft invalidation is conservative)', async () => {
    document.body.innerHTML = `<textarea id="input"></textarea><button id="send">Send</button>`
    const script = generateAutoSendScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      'first',
      false
    )

    await window.eval(script)

    // Trigger SPA nav but KEEP the same element in DOM
    window.history.pushState({}, '', '/same-element-route')
    await new Promise((r) => setTimeout(r, 5))

    // After the nav, cache was cleared. New run should re-resolve and re-cache.
    const after = await window.eval(script)
    expect(after.success).toBe(true)
    expect(after.diagnostics.input.strategy).toBe('direct')
  })
})
