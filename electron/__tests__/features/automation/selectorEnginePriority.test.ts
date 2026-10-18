import { selectorEngine } from '@electron/features/automation/automationScripts/lib/selectorEngine'
import { selectorRepairRuntime } from '@electron/features/automation/automationScripts/lib/selectorRepairRuntime'
import { siteStrategyRuntime } from '@electron/features/automation/automationScripts/lib/siteStrategyRegistry'

import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Selector engine'in template literal içindeki davranışını doğrulayan testler.
 * Burada amaç: gerçek bir uzak sayfanın `eval()` çağrısında karşılaşacağı kodu
 * mümkün olduğunca birebir taklit etmek.
 */
describe('selectorEngine template behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // ── Yardımcı: tüm site-strategy + selector-engine template'ini eval edip
  //    sınıflandırma / sıralama fonksiyonlarını dış dünyaya açar.
  const buildHarness = () => `() => {
    // Stubs for helpers normally injected by the script preamble
    const uniqueStrings = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
    const now = () => Date.now();
    const roundMs = (v) => Math.round(v);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const CONFIDENCE_THRESHOLD_MEDIUM = 0.3;
    const getSearchRoots = () => [document];
    const getAutomationCache = () => ({ elements: {}, pageUrl: location.href });
    const isReadyForInteraction = (el) => !!el && el.isConnected;
    const computeConfidenceScore = (c) => ({ score: 1, level: 'high' });
    const findUniqueSelectorMatch = () => ({ element: null, matchedSelector: null, strategy: 'none' });
    const findElementByFingerprint = () => null;
    const cacheElement = () => {};
    const getCachedElement = () => null;
    const invalidateCacheEntry = () => {};
    const tryChatGptComposerFallback = () => null;
    const tryGeminiComposerFallback = () => null;
    const tryGeminiButtonFallback = () => null;
    ${siteStrategyRuntime}
    ${selectorEngine}
    return {
      classify: __classifySelector,
      sort: __sortSelectorsByPriority,
      priority: __selectorPriority
    }
  }`

  describe('__classifySelector', () => {
    const getHelpers = () =>
      (window.eval(buildHarness()) as () => unknown)() as {
        classify: (sel: string) => string
      }

    it('classifies every supported selector shape, and falls back for the rest', () => {
      const h = getHelpers()

      const classified: Array<[string, string]> = [
        // id
        ['#input', 'id'],
        ['#chat-input-2', 'id'],
        // stabil bağlar
        ['[data-testid="composer"]', 'dataTestId'],
        ['[aria-label="Send"]', 'ariaLabel'],
        ['[role="textbox"]', 'role'],
        ['[name="q"]', 'name'],
        ['[placeholder="Ask"]', 'placeholder'],
        ['[type="text"]', 'type'],
        ['[contenteditable="true"]', 'contentEditable'],
        // kırılgan bağlar
        ['textarea.chat-input', 'tagClass'],
        ['div[class*=editor]', 'tagClass'],
        ['div:nth-child(3)', 'tagNth'],
        // runtime işaretçisi
        ['fingerprint:abc123', 'fingerprint'],
        // geri düşüş
        ['', 'fallback'],
        ['   ', 'fallback'],
        ['textarea', 'fallback']
      ]

      for (const [selector, expected] of classified) {
        expect(h.classify(selector), `classify(${JSON.stringify(selector)})`).toBe(expected)
      }
    })
  })

  describe('__sortSelectorsByPriority', () => {
    const getHelpers = () =>
      (window.eval(buildHarness()) as () => unknown)() as {
        sort: (sels: string[]) => string[]
      }

    it('orders, prioritizes, deduplicates and stays stable', () => {
      const h = getHelpers()

      // Tam öncelik sırası: id > dataTestId > ariaLabel > placeholder >
      // tagClass > tagNth > fallback.
      expect(
        h.sort([
          'textarea',
          'textarea.chat-input',
          'div:nth-child(2)',
          '[placeholder="Ask"]',
          '[aria-label="Send"]',
          '[data-testid="composer"]',
          '#composer-input'
        ])
      ).toEqual([
        '#composer-input',
        '[data-testid="composer"]',
        '[aria-label="Send"]',
        '[placeholder="Ask"]',
        'textarea.chat-input',
        'div:nth-child(2)',
        'textarea'
      ])

      // fingerprint işaretçisi her şeyin önünde gelir.
      expect(h.sort(['textarea', '#input', 'fingerprint:abc'])).toEqual([
        'fingerprint:abc',
        '#input',
        'textarea'
      ])

      // Eşit öncelikte kararlı (alfabetik) sıra korunur.
      expect(h.sort(['#b', '#a', '#c'])).toEqual(['#a', '#b', '#c'])

      // Aynı seçici iki kez verilirse tekrarlar ayıklanır.
      expect(h.sort(['#a', '#a', '#b'])).toEqual(['#a', '#b'])
    })
  })

  // S11 (runtime): the button filter (SEND_BLOCKLIST + __isLikelySendButton)
  // lives inside the runtime template. The blocklist used to be a closure
  // inside `trySemanticFallback`; it now lives in the shared self-healing
  // runtime block so that runtime selection and persisted auto-repair apply the
  // exact same rule and cannot drift. The harness below therefore has to embed
  // that block first, in the same order `buildCommonHelpers` uses.
  //
  // The harness exposes the filter so we can assert the "icon-only send button
  // in a form" case — without the recent fix the function returned false for an
  // empty-text button regardless of form association, dropping the real send
  // button on sites that hide the icon.
  describe('trySemanticFallback button filter', () => {
    type FilterHarness = {
      trySemanticFallback: (
        kind: string,
        config?: unknown
      ) => {
        element: HTMLElement | null
        matchedSelector?: string
        strategy?: string
      } | null
    }

    const buildFilterHarness = () => `() => {
      const uniqueStrings = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
      const now = () => Date.now();
      const roundMs = (v) => Math.round(v);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const CONFIDENCE_THRESHOLD_MEDIUM = 0.3;
      const CONFIDENCE_THRESHOLD_HIGH = 0.7;
      const getSearchRoots = () => [document];
      const getAutomationCache = () => ({ elements: {}, pageUrl: location.href });
      const isReadyForInteraction = (el) => !!el && el.isConnected;
      const computeConfidenceScore = (c) => ({ score: 1, level: 'high' });
      const findUniqueSelectorMatch = () => ({ element: null, matchedSelector: null, strategy: 'none' });
      const findElementByFingerprint = () => null;
      const cacheElement = () => {};
      const getCachedElement = () => null;
      const invalidateCacheEntry = () => {};
      const tryChatGptComposerFallback = () => null;
      const tryGeminiComposerFallback = () => null;
      const tryGeminiButtonFallback = () => null;
      const uniqueElements = (arr) => Array.from(new Set(arr));
      ${selectorRepairRuntime}
      ${siteStrategyRuntime}
      ${selectorEngine}
      return { trySemanticFallback }
    }`

    const getHarness = () => (window.eval(buildFilterHarness()) as () => unknown)() as FilterHarness

    it('drops sidebar/settings/new-chat buttons from the candidate pool', () => {
      document.body.innerHTML = `
        <aside>
          <button aria-label="New chat">+</button>
          <button aria-label="Settings">⚙</button>
          <button aria-label="Sidebar toggle">≡</button>
        </aside>
      `
      const h = getHarness()
      const result = h.trySemanticFallback('button', undefined)
      expect(result).toBeNull()
    })

    it('keeps an icon-only send button that lives inside a form', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" />
          <button type="button" aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24"></svg>
          </button>
        </form>
      `
      const h = getHarness()
      const result = h.trySemanticFallback('button', undefined)
      expect(result).not.toBeNull()
      expect(result?.element?.closest('form')).not.toBeNull()
    })

    it('keeps a button whose aria-label is "Send" even outside a form', () => {
      document.body.innerHTML = `
        <div>
          <button aria-label="Send message">→</button>
        </div>
      `
      const h = getHarness()
      const result = h.trySemanticFallback('button', undefined)
      expect(result).not.toBeNull()
    })

    it('keeps a button whose textContent contains "gönder" (Turkish send)', () => {
      document.body.innerHTML = `
        <div>
          <button>Gönder</button>
        </div>
      `
      const h = getHarness()
      const result = h.trySemanticFallback('button', undefined)
      expect(result).not.toBeNull()
    })

    it('does not surface icon-only buttons with no form / no text / no config', () => {
      document.body.innerHTML = `
        <div>
          <button><svg width="16" height="16"></svg></button>
        </div>
      `
      const h = getHarness()
      const result = h.trySemanticFallback('button', undefined)
      expect(result).toBeNull()
    })
  })
})
