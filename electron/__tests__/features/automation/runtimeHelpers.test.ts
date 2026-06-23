import { errorClassifierRuntime } from '@electron/features/automation/automationScripts/lib/errorClassifierRuntime'
import { eventDrivenWaitRuntime } from '@electron/features/automation/automationScripts/lib/eventDrivenWait'
import { siteStrategyRuntime } from '@electron/features/automation/automationScripts/lib/siteStrategyRegistry'

import { describe, expect, it } from 'vitest'

/**
 * Bu testler, generated script'lerin parçası olan helper template'lerini
 * doğrudan JSDOM `window.eval()` üzerinden çalıştırır. Yani yardımcı
 * fonksiyonların "runtime" davranışını (template literal'ın JS string'e
 * dönüşmesi sonrası) test eder.
 *
 * Not: `window.eval` bir function body bekler; tüm harness'ler arrow
 * function içine sarılmıştır.
 */
describe('runtime helpers (webview template strings)', () => {
  describe('errorClassifierRuntime', () => {
    const harness = `() => {
      ${errorClassifierRuntime}
      return {
        classify: __classifyError,
        retryBudget: __retryBudgetFor,
        normalize: __normalizeErrorCode
      }
    }`

    it('classifies selector errors with after-repick policy', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        classify: (raw: string) => {
          retry: string
          triggerFallback: boolean
          category: string
          toastKey: string
        }
      }
      const result = helpers.classify('input_not_found')
      expect(result.category).toBe('selector')
      expect(result.retry).toBe('after-repick')
      expect(result.triggerFallback).toBe(false)
    })

    it('classifies submit_not_ready as different-strategy with fallback', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        classify: (raw: string) => {
          retry: string
          triggerFallback: boolean
          category: string
          toastKey: string
        }
      }
      const result = helpers.classify('submit_not_ready')
      expect(result.category).toBe('submit')
      expect(result.retry).toBe('different-strategy')
      expect(result.triggerFallback).toBe(true)
    })

    it('classifies timed_out substring as timeout category', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        classify: (raw: string) => { category: string; retry: string }
      }
      expect(helpers.classify('image_upload_timed_out').category).toBe('timeout')
      expect(helpers.classify('click_send_timeout').category).toBe('timeout')
    })

    it('falls back to unknown category for unrecognized codes', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        classify: (raw: string) => { category: string; toastKey: string }
      }
      const result = helpers.classify('something_random')
      expect(result.category).toBe('unknown')
      expect(result.toastKey).toBe('toast_automation_failed')
    })

    it('normalizes "Illegal invocation" to unknown', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        normalize: (raw: string) => string
      }
      expect(helpers.normalize('Illegal invocation')).toBe('unknown')
    })

    it('returns 0 retry budget for never and after-repick', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        retryBudget: (raw: string) => number
      }
      expect(helpers.retryBudget('webview_destroyed')).toBe(0)
      expect(helpers.retryBudget('input_not_found')).toBe(0)
    })

    it('returns 1 retry budget for same-strategy / different-strategy', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        retryBudget: (raw: string) => number
      }
      expect(helpers.retryBudget('submit_failed')).toBe(1)
      expect(helpers.retryBudget('submit_not_ready')).toBe(1)
    })

    it('returns 2 retry budget for after-backoff', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        retryBudget: (raw: string) => number
      }
      expect(helpers.retryBudget('network_error')).toBe(2)
      expect(helpers.retryBudget('clipboard_failed')).toBe(2)
    })
  })

  describe('siteStrategyRuntime', () => {
    const harness = `() => {
      ${siteStrategyRuntime}
      return {
        register: __registerSiteStrategy,
        list: __listApplicableStrategies,
        run: __runSiteStrategy
      }
    }`

    it('registers and lists strategies by hostname', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        register: (s: unknown) => void
        list: (hostname: string) => Array<{ id: string }>
      }
      helpers.register({
        id: 'test:foo',
        match: { hostPatterns: ['foo.com'], priority: 1 },
        produce: () => null
      })
      const matches = helpers.list('foo.com')
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('test:foo')
    })

    it('returns empty list when no strategies match', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        list: (hostname: string) => unknown[]
      }
      expect(helpers.list('no-such-host.com')).toEqual([])
    })

    it('sorts by priority (highest first)', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        register: (s: unknown) => void
        list: (hostname: string) => Array<{ id: string }>
      }
      helpers.register({
        id: 'a',
        match: { hostPatterns: ['x.com'], priority: 1 },
        produce: () => null
      })
      helpers.register({
        id: 'b',
        match: { hostPatterns: ['x.com'], priority: 5 },
        produce: () => null
      })
      helpers.register({
        id: 'c',
        match: { hostPatterns: ['x.com'], priority: 3 },
        produce: () => null
      })

      const matches = helpers.list('x.com')
      expect(matches.map((m) => m.id)).toEqual(['b', 'c', 'a'])
    })

    it('skips strategies whose produce() throws', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        register: (s: unknown) => void
        run: (hostname: string, kind: string) => { strategyId: string } | null
      }
      document.body.innerHTML = '<button id="ok">Send</button>'
      helpers.register({
        id: 'broken',
        match: { hostPatterns: ['x.com'], priority: 100 },
        produce: () => {
          throw new Error('boom')
        }
      })
      helpers.register({
        id: 'working',
        match: { hostPatterns: ['x.com'], priority: 50 },
        produce: (kind: string) => {
          if (kind === 'input') {
            return {
              element: document.createElement('textarea'),
              matchedSelector: 'ta',
              strategy: 'provider' as const
            }
          }
          return {
            element: document.getElementById('ok')!,
            matchedSelector: '#ok',
            strategy: 'provider' as const
          }
        }
      })

      const result = helpers.run('x.com', 'button')
      expect(result).not.toBeNull()
      expect(result?.strategyId).toBe('working')
    })

    it('returns null when no produce() yields an element', () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        register: (s: unknown) => void
        run: (hostname: string, kind: string) => unknown
      }
      helpers.register({
        id: 'silent',
        match: { hostPatterns: ['x.com'] },
        produce: () => null
      })
      expect(helpers.run('x.com', 'input')).toBeNull()
    })
  })

  describe('eventDrivenWaitRuntime', () => {
    const harness = `() => {
      // Stubs for helpers normally injected by the script preamble
      const now = () => Date.now();
      const roundMs = (v) => Math.round(v);
      ${eventDrivenWaitRuntime}
      return { wait: __eventDrivenWait }
    }`

    it('resolves immediately if check() returns truthy on first call', async () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        wait: (params: {
          root: Element
          check: () => boolean
          timeoutMs: number
          settleMs: number
          minimumWaitMs: number
        }) => Promise<{ result: unknown; totalMs: number }>
      }
      const result = await helpers.wait({
        root: document.body,
        check: () => true,
        timeoutMs: 1000,
        settleMs: 0,
        minimumWaitMs: 0
      })
      expect(result.result).toBe(true)
      expect(result.totalMs).toBeGreaterThanOrEqual(0)
    })

    it('returns null when timeout elapses before check() passes', async () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        wait: (params: {
          root: Element
          check: () => boolean
          timeoutMs: number
          settleMs: number
          minimumWaitMs: number
        }) => Promise<{ result: unknown; totalMs: number }>
      }
      const start = Date.now()
      const result = await helpers.wait({
        root: document.body,
        check: () => false,
        timeoutMs: 200,
        settleMs: 0,
        minimumWaitMs: 0
      })
      const elapsed = Date.now() - start
      expect(result.result).toBeNull()
      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(elapsed).toBeLessThan(800)
    })

    it('wakes up on DOM mutation instead of busy-polling', async () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        wait: (params: {
          root: Element
          check: () => boolean
          timeoutMs: number
          settleMs: number
          minimumWaitMs: number
        }) => Promise<{ result: unknown; totalMs: number }>
      }
      document.body.innerHTML = '<div id="probe"></div>'

      const probe = document.getElementById('probe')!
      let isReady = false
      const check = () => {
        if (probe.getAttribute('data-ready') === 'yes') {
          isReady = true
          return true
        }
        return false
      }

      setTimeout(() => {
        probe.setAttribute('data-ready', 'yes')
      }, 80)

      const start = Date.now()
      const result = await helpers.wait({
        root: document.body,
        check,
        timeoutMs: 2000,
        settleMs: 30,
        minimumWaitMs: 0
      })
      const elapsed = Date.now() - start
      expect(result.result).toBe(true)
      expect(isReady).toBe(true)
      expect(elapsed).toBeLessThan(800)
    })

    it('respects minimumWaitMs - check cannot pass before then', async () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        wait: (params: {
          root: Element
          check: () => boolean
          timeoutMs: number
          settleMs: number
          minimumWaitMs: number
        }) => Promise<{ result: unknown; totalMs: number }>
      }
      const start = Date.now()
      const result = await helpers.wait({
        root: document.body,
        check: () => true,
        timeoutMs: 1000,
        settleMs: 0,
        minimumWaitMs: 250
      })
      const elapsed = Date.now() - start
      expect(result.result).toBe(true)
      expect(elapsed).toBeGreaterThanOrEqual(200)
    })

    it('respects settleMs - result waits for stable DOM', async () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        wait: (params: {
          root: Element
          check: () => boolean
          timeoutMs: number
          settleMs: number
          minimumWaitMs: number
        }) => Promise<{ result: unknown; totalMs: number }>
      }
      document.body.innerHTML = '<div id="container"></div>'
      const container = document.getElementById('container')!

      let mutationCount = 0
      let passedMinimum = false

      const mutatorInterval = setInterval(() => {
        mutationCount += 1
        if (passedMinimum) return
        container.appendChild(document.createElement('span'))
      }, 20)

      setTimeout(() => {
        passedMinimum = true
        clearInterval(mutatorInterval)
      }, 300)

      const start = Date.now()
      const result = await helpers.wait({
        root: document.body,
        check: () => {
          return passedMinimum && mutationCount > 5
        },
        timeoutMs: 2000,
        settleMs: 50,
        minimumWaitMs: 200
      })
      const elapsed = Date.now() - start
      expect(result.result).toBe(true)
      expect(elapsed).toBeLessThan(1500)
    }, 10000)

    it('falls back to document.body when root is invalid', async () => {
      const helpers = (window.eval(harness) as () => unknown)() as {
        wait: (params: {
          root: unknown
          check: () => boolean
          timeoutMs: number
          settleMs: number
          minimumWaitMs: number
        }) => Promise<{ result: unknown }>
      }
      const result = await helpers.wait({
        root: null,
        check: () => true,
        timeoutMs: 500,
        settleMs: 0,
        minimumWaitMs: 0
      })
      expect(result.result).toBe(true)
    })
  })
})
