import { selectorEngine } from '@electron/features/automation/automationScripts/lib/selectorEngine'
import { siteStrategyRuntime } from '@electron/features/automation/automationScripts/lib/siteStrategyRegistry'

import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Selector engine'in template literal içindeki davranışını doğrulayan testler.
 * Burada amaç: gerçek bir webview'in `eval()` çağrısında karşılaşacağı kodu
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

    it('classifies ID selectors as id', () => {
      const h = getHelpers()
      expect(h.classify('#input')).toBe('id')
      expect(h.classify('#chat-input-2')).toBe('id')
    })

    it('classifies data-testid / aria-label / role / name / placeholder / type', () => {
      const h = getHelpers()
      expect(h.classify('[data-testid="composer"]')).toBe('dataTestId')
      expect(h.classify('[aria-label="Send"]')).toBe('ariaLabel')
      expect(h.classify('[role="textbox"]')).toBe('role')
      expect(h.classify('[name="q"]')).toBe('name')
      expect(h.classify('[placeholder="Ask"]')).toBe('placeholder')
      expect(h.classify('[type="text"]')).toBe('type')
    })

    it('classifies contenteditable', () => {
      const h = getHelpers()
      expect(h.classify('[contenteditable="true"]')).toBe('contentEditable')
    })

    it('classifies tag.class and tag[class*=] as tagClass', () => {
      const h = getHelpers()
      expect(h.classify('textarea.chat-input')).toBe('tagClass')
      expect(h.classify('div[class*=editor]')).toBe('tagClass')
    })

    it('classifies :nth-child as tagNth', () => {
      const h = getHelpers()
      expect(h.classify('div:nth-child(3)')).toBe('tagNth')
    })

    it('classifies fingerprint: prefix', () => {
      const h = getHelpers()
      expect(h.classify('fingerprint:abc123')).toBe('fingerprint')
    })

    it('returns fallback for empty / unknown / tag-only selectors', () => {
      const h = getHelpers()
      expect(h.classify('')).toBe('fallback')
      expect(h.classify('   ')).toBe('fallback')
      expect(h.classify('textarea')).toBe('fallback')
    })
  })

  describe('__sortSelectorsByPriority', () => {
    const getHelpers = () =>
      (window.eval(buildHarness()) as () => unknown)() as {
        sort: (sels: string[]) => string[]
      }

    it('puts high-priority (id) before low-priority (tagClass)', () => {
      const h = getHelpers()
      const sorted = h.sort(['textarea.chat-input', '#input'])
      expect(sorted[0]).toBe('#input')
      expect(sorted[1]).toBe('textarea.chat-input')
    })

    it('orders by priority: id > dataTestId > ariaLabel > placeholder > tagClass > tagNth > fallback', () => {
      const h = getHelpers()
      const sorted = h.sort([
        'textarea',
        'textarea.chat-input',
        'div:nth-child(2)',
        '[placeholder="Ask"]',
        '[aria-label="Send"]',
        '[data-testid="composer"]',
        '#composer-input'
      ])
      expect(sorted).toEqual([
        '#composer-input',
        '[data-testid="composer"]',
        '[aria-label="Send"]',
        '[placeholder="Ask"]',
        'textarea.chat-input',
        'div:nth-child(2)',
        'textarea'
      ])
    })

    it('puts fingerprint selector first (priority 110)', () => {
      const h = getHelpers()
      const sorted = h.sort(['textarea', '#input', 'fingerprint:abc'])
      expect(sorted[0]).toBe('fingerprint:abc')
      expect(sorted[1]).toBe('#input')
      expect(sorted[2]).toBe('textarea')
    })

    it('is stable for selectors of equal priority (preserves alphabetical order)', () => {
      const h = getHelpers()
      const sorted = h.sort(['#b', '#a', '#c'])
      expect(sorted).toEqual(['#a', '#b', '#c'])
    })

    it('deduplicates input via uniqueStrings', () => {
      const h = getHelpers()
      const sorted = h.sort(['#a', '#a', '#b'])
      expect(sorted).toEqual(['#a', '#b'])
    })
  })

  // S11 (runtime): the button filter (SEND_BLOCKLIST + isLikelySendButton)
  // lives inside the template literal as a closure that depends on
  // `config`. The harness below exposes it so we can assert the
  // "icon-only send button in a form" case — without the recent fix
  // the function returned false for an empty-text button regardless
  // of form association, dropping the real send button on sites
  // that hide the icon.
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
