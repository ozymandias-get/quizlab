/** @file Improved selector engine – priority‑ordered, SPA‑aware, with soft cache invalidation. */
// Single source of truth — shared engine (shared/lib/selectorEngine.ts) is canonical.
// This Electron wrapper re-exports the shared constants/helpers so both layers
// give the same score for the same selector (see P3 test).
import {
  classifySelector as __sharedClassifySelector,
  SELECTOR_PRIORITY as __SHARED_PRIORITY,
  sortSelectorsByPriority as __sharedSortSelectorsByPriority
} from '../../../../../shared/lib/selectorEngine.js'
export {
  classifySelector,
  SELECTOR_PRIORITY,
  sortSelectorsByPriority
} from '../../../../../shared/lib/selectorEngine.js'

import { fallbackPipeline } from './fallbackPipeline.js'

export const selectorEngine =
  `    /**
     * Selector öncelik tablosu. Yüksek sayı = daha kararlı.
     * İlk eşleşen selector yerine en yüksek öncelikli selector cache'lenir.
     */
    const __SELECTOR_PRIORITY = Object.freeze({
        id: 100,
        dataTestId: 90,
        ariaLabel: 75,
        role: 65,
        name: 60,
        placeholder: 50,
        type: 45,
        contentEditable: 40,
        tagClass: 25,
        tagNth: 10,
        fingerprint: 110,
        fallback: 0
    });

    const __MAX_FALLBACK_ATTEMPTS = 3;
    const __FALLBACK_STEP_TIMEOUT_MS = 500;

    /**
     * SPA navigasyonu için hafif bir dinleyici. location.href'i pushState/replaceState
     * üzerinden değiştiren sayfalar (örn. ChatGPT) için cache invalidation
     * tetikler.
     */
    const __installSpaNavigationProbe = () => {
        if (window.__quizlabSpaProbeInstalled) return;
        window.__quizlabSpaProbeInstalled = true;
        try {
            const originalPush = history.pushState;
            const originalReplace = history.replaceState;
            history.pushState = function () {
                const result = originalPush.apply(this, arguments);
                window.dispatchEvent(new Event('__quizlabSpaNav'));
                return result;
            };
            history.replaceState = function () {
                const result = originalReplace.apply(this, arguments);
                window.dispatchEvent(new Event('__quizlabSpaNav'));
                return result;
            };
            window.addEventListener('popstate', () => {
                window.dispatchEvent(new Event('__quizlabSpaNav'));
            });
        } catch (e) {
            // SPA probe kurulamadıysa cache invalidation yalnızca DOM bazlı olur
        }
    };

    /**
     * SPA navigasyonu algılandığında cache'i "soft" temizler.
     */
    const __softInvalidateAllOnNav = () => {
        try {
            const cache = getAutomationCache();
            cache.elements = {};
            cache.pageUrl = window.location.href;
        } catch (e) {
            // cache boşsa yoksay
        }
    };

    if (typeof window !== 'undefined') {
        __installSpaNavigationProbe();
        window.addEventListener('__quizlabSpaNav', __softInvalidateAllOnNav);
    }

    /**
     * Selector string'inin kategorisini tahmin eder.
     * Önceliklendirme için kullanılır.
     *
     * NOT: Her regex ters eğik çizgisi TS template literal'da iki kez
     * escape edilmelidir.
     */
    const __classifySelector = (selector) => {
        const s = String(selector || '').trim();
        if (!s) return 'fallback';
        if (/^#[a-zA-Z][\\w-]*$/.test(s)) return 'id';
        if (/\\[(?:data-testid|data-test-id)\\s*=/.test(s)) return 'dataTestId';
        if (/\\[aria-label\\s*=/.test(s)) return 'ariaLabel';
        if (/\\[role\\s*=/.test(s)) return 'role';
        if (/\\[name\\s*=/.test(s)) return 'name';
        if (/\\[placeholder\\s*=/.test(s)) return 'placeholder';
        if (/\\[type\\s*=/.test(s)) return 'type';
        if (/\\[contenteditable/.test(s)) return 'contentEditable';
        if (/^\\w+\\.[\\w.-]+/.test(s) || /^\\w+\\[class\\*=/.test(s)) return 'tagClass';
        if (/:nth-child\\(/.test(s)) return 'tagNth';
        if (/^fingerprint:/.test(s)) return 'fingerprint';
        return 'fallback';
    };

    const __selectorPriority = (selector) => {
        return __SELECTOR_PRIORITY[__classifySelector(selector)] || 0;
    };

    /**
     * Selector listesini önceliğe göre azalan sırada döner.
     */
    const __sortSelectorsByPriority = (selectors) => {
        const list = uniqueStrings(selectors);
        return list.slice().sort((a, b) => {
            const pa = __selectorPriority(a);
            const pb = __selectorPriority(b);
            if (pa !== pb) return pb - pa;
            return a < b ? -1 : (a > b ? 1 : 0);
        });
    };

    const resolveWithFallback = async (lookup, kind, diagnostics, config, timeout = 10000, mustBeInteractive = false) => {
        const start = now();
        let attempts = 0;
        let fallbackAttempts = 0;

        while (now() - start < timeout) {
            if (typeof isAborted === 'function' && isAborted()) {
                break;
            }
            attempts += 1;
            const result = queryElementWithPipeline(lookup, kind, diagnostics, config, fallbackAttempts);
            const element = result.element;

            if (element && (!mustBeInteractive || isReadyForInteraction(element))) {
                diagnostics.waitIterations = attempts;
                diagnostics.interactiveRequired = mustBeInteractive;
                diagnostics.durationMs = roundMs(now() - start);
                diagnostics.fallbackAttempts = fallbackAttempts;
                return result;
            }

            if (result.element && !result.element.isConnected) {
                invalidateCacheEntry(kind, lookup, diagnostics);
            }

            if (fallbackAttempts < __MAX_FALLBACK_ATTEMPTS) {
                fallbackAttempts += 1;
            }

            await wait(250);
        }

        diagnostics.waitIterations = attempts;
        diagnostics.interactiveRequired = mustBeInteractive;
        diagnostics.durationMs = roundMs(now() - start);
        diagnostics.fallbackAttempts = fallbackAttempts;
        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const queryElementWithPipeline = (lookup, kind, diagnostics, config, fallbackDepth = 0) => {
        const cached = getCachedElement(kind, lookup, diagnostics);
        if (cached) {
            return cached;
        }

        const selectors = __sortSelectorsByPriority(lookup && lookup.selectors);
        const fingerprint = lookup && lookup.fingerprint;
        let best = null;
        let bestPriority = -1;
        for (const selector of selectors) {
            const matched = findUniqueSelectorMatch(selector, fingerprint);
            if (matched.element) {
                const p = __selectorPriority(selector);
                if (!best || p > bestPriority) {
                    best = Object.assign({ priority: p, selector: selector }, matched);
                    bestPriority = p;
                }
                if (p >= __SELECTOR_PRIORITY.id) break;
            }
        }

        if (best && best.element) {
            cacheElement(kind, lookup, best.matchedSelector, best.element);
            diagnostics.strategy = best.strategy;
            diagnostics.matchedSelector = best.matchedSelector;
            return best;
        }

        const fingerprintMatch = findElementByFingerprint(lookup && lookup.fingerprint);
        if (fingerprintMatch && fingerprintMatch.element) {
            cacheElement(kind, lookup, fingerprintMatch.matchedSelector, fingerprintMatch.element);
            diagnostics.strategy = 'fingerprint';
            diagnostics.matchedSelector = fingerprintMatch.matchedSelector;
            return fingerprintMatch;
        }

        if (fallbackDepth >= __MAX_FALLBACK_ATTEMPTS) {
            return { element: null, matchedSelector: null, strategy: 'none' };
        }

        const fallbackResult = runFallbackPipeline(kind, config, diagnostics, fallbackDepth);
        if (fallbackResult && fallbackResult.element) {
            cacheElement(kind, lookup, fallbackResult.matchedSelector, fallbackResult.element);
            diagnostics.strategy = fallbackResult.strategy;
            diagnostics.matchedSelector = fallbackResult.matchedSelector;
            return fallbackResult;
        }

        return { element: null, matchedSelector: null, strategy: 'none' };
    };

` +
  fallbackPipeline +
  `\n`
