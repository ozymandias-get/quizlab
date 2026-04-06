/**
 * AI Automation Script Generator
 * Generates safe JavaScript code for webview execution.
 */
import { normalizeSubmitMode } from '../../../shared/selectorConfig'
import type { AutomationConfig } from '@shared-core/types'

export type { AutomationConfig }

interface ScriptLookupConfig {
  selectors: string[]
  fingerprint: AutomationConfig['inputFingerprint']
}

interface SerializedAutomationConfig {
  input: ScriptLookupConfig
  button: ScriptLookupConfig
  waitFor: ScriptLookupConfig
  submitMode: string
  health: AutomationConfig['health'] | null
}

function uniqueSelectors(values: Array<string | null | undefined>) {
  const selectors: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const normalized = value.trim()
    if (!normalized || selectors.includes(normalized)) continue
    selectors.push(normalized)
  }

  return selectors
}

function serializeAutomationConfig(config: AutomationConfig): SerializedAutomationConfig {
  return {
    input: {
      selectors: uniqueSelectors([
        config.input,
        ...(Array.isArray(config.inputCandidates) ? config.inputCandidates : []),
        config.waitFor
      ]),
      fingerprint: config.inputFingerprint || null
    },
    button: {
      selectors: uniqueSelectors([
        config.button,
        ...(Array.isArray(config.buttonCandidates) ? config.buttonCandidates : [])
      ]),
      fingerprint: config.buttonFingerprint || null
    },
    waitFor: {
      selectors: uniqueSelectors([
        config.waitFor,
        config.input,
        ...(Array.isArray(config.inputCandidates) ? config.inputCandidates : [])
      ]),
      fingerprint: config.inputFingerprint || null
    },
    submitMode: normalizeSubmitMode(config.submitMode) || 'mixed',
    health: config.health || null
  }
}

function buildCommonHelpers(ambiguousSelectorBehavior: 'pick' | 'reject'): string {
  return `
    const AMBIGUOUS_SELECTOR_BEHAVIOR = '${ambiguousSelectorBehavior}';
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now());
    const roundMs = (value) => Math.round(value * 100) / 100;
    const normalizeText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();

    const uniqueStrings = (values) => {
        const unique = [];
        for (const value of Array.isArray(values) ? values : []) {
            if (typeof value !== 'string') continue;
            const normalized = value.trim();
            if (!normalized || unique.includes(normalized)) continue;
            unique.push(normalized);
        }
        return unique;
    };

    const createSelectorDiagnostics = (selector, interactiveRequired = false) => ({
        requestedSelector: selector || null,
        matchedSelector: null,
        strategy: 'none',
        durationMs: 0,
        waitIterations: 0,
        cacheHits: 0,
        cacheInvalidations: 0,
        interactiveRequired
    });

    const createDiagnostics = (kind, options = {}) => ({
        kind,
        pageUrl: window.location.href,
        totalMs: 0,
        input: createSelectorDiagnostics(options.inputSelector || ''),
        button: options.includeButton ? createSelectorDiagnostics(options.buttonSelector || '', true) : undefined,
        setInputMs: 0,
        submitMs: 0,
        error: null
    });

    const finalizeDiagnostics = (diagnostics, startedAt, error = null) => {
        diagnostics.totalMs = roundMs(now() - startedAt);
        diagnostics.error = error;
        return diagnostics;
    };

    const getAutomationCache = () => {
        const cacheKey = '__quizlabReaderAutomationCache';
        const globalCache = window[cacheKey] || {};

        if (!globalCache.elements || typeof globalCache.elements !== 'object') {
            globalCache.elements = {};
        }

        if (globalCache.pageUrl !== window.location.href) {
            globalCache.pageUrl = window.location.href;
            globalCache.elements = {};
        }

        window[cacheKey] = globalCache;
        return globalCache;
    };

    const getLookupCacheKey = (lookup) => JSON.stringify({
        selectors: uniqueStrings(lookup && lookup.selectors),
        fingerprint: lookup && lookup.fingerprint ? lookup.fingerprint : null
    });

    const getCacheEntry = (kind, lookup) => {
        const cache = getAutomationCache();
        const key = kind + '::' + getLookupCacheKey(lookup);

        if (!cache.elements[key]) {
            cache.elements[key] = {
                element: null,
                matchedSelector: null
            };
        }

        return cache.elements[key];
    };

    const invalidateCacheEntry = (kind, lookup, diagnostics) => {
        const entry = getCacheEntry(kind, lookup);
        if (!entry.element && !entry.matchedSelector) {
            return;
        }

        entry.element = null;
        entry.matchedSelector = null;
        if (diagnostics) {
            diagnostics.cacheInvalidations += 1;
        }
    };

    const getCachedElement = (kind, lookup, diagnostics) => {
        const entry = getCacheEntry(kind, lookup);
        const element = entry.element;

        if (element && element.isConnected !== false) {
            diagnostics.cacheHits += 1;
            diagnostics.strategy = 'cache';
            diagnostics.matchedSelector = entry.matchedSelector || diagnostics.requestedSelector || null;
            return {
                element,
                matchedSelector: diagnostics.matchedSelector,
                strategy: 'cache'
            };
        }

        if (entry.element || entry.matchedSelector) {
            invalidateCacheEntry(kind, lookup, diagnostics);
        }

        return null;
    };

    const cacheElement = (kind, lookup, matchedSelector, element) => {
        const entry = getCacheEntry(kind, lookup);
        entry.element = element || null;
        entry.matchedSelector = matchedSelector || null;
    };

    const collectShadowRoots = (root, accumulator, visitedHosts) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node && node.shadowRoot && !visitedHosts.has(node)) {
                visitedHosts.add(node);
                accumulator.push(node.shadowRoot);
                collectShadowRoots(node.shadowRoot, accumulator, visitedHosts);
            }
        }
    };

    const getSearchRoots = () => {
        const roots = [document];
        collectShadowRoots(document, roots, new Set());
        return roots;
    };

    const uniqueElements = (elements) => {
        const unique = [];
        const seen = new Set();
        for (const element of elements) {
            if (!element || seen.has(element)) continue;
            seen.add(element);
            unique.push(element);
        }
        return unique;
    };

    const pickPrimaryInputCandidate = (elements) => {
        const list = Array.isArray(elements) ? elements.filter((el) => el && el.isConnected) : [];
        if (list.length === 0) return null;
        if (list.length === 1) return list[0];
        const scored = list.map((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const area = rect.width * rect.height;
            const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            const role = (el.getAttribute && el.getAttribute('role')) || '';
            const preferBoost = role === 'textbox' ? 2 : 1;
            return { el, area, visible, preferBoost };
        });
        const visible = scored.filter((s) => s.visible);
        const pool = visible.length > 0 ? visible : scored;
        pool.sort((a, b) => {
            if (b.preferBoost !== a.preferBoost) return b.preferBoost - a.preferBoost;
            return b.area - a.area;
        });
        return pool[0].el;
    };

    const findUniqueSelectorMatch = (selector) => {
        const roots = getSearchRoots();
        const directMatches = uniqueElements(Array.from(document.querySelectorAll(selector)));
        const allMatches = uniqueElements(roots.flatMap((root) => Array.from(root.querySelectorAll(selector))));

        if (allMatches.length === 0) {
            return {
                element: null,
                matchedSelector: null,
                strategy: 'none'
            };
        }

        if (allMatches.length === 1) {
            const element = allMatches[0];
            const strategy = directMatches.includes(element) ? 'direct' : 'recursive';
            return {
                element,
                matchedSelector: selector,
                strategy
            };
        }

        if (AMBIGUOUS_SELECTOR_BEHAVIOR === 'pick') {
            const picked = pickPrimaryInputCandidate(allMatches);
            if (picked) {
                const strategy = directMatches.includes(picked) ? 'direct' : 'recursive';
                return {
                    element: picked,
                    matchedSelector: selector,
                    strategy
                };
            }
        }

        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const matchesClassTokens = (element, classTokens) => {
        if (!Array.isArray(classTokens) || classTokens.length === 0) {
            return true;
        }

        return classTokens.every((token) => element.classList && element.classList.contains(token));
    };

    const findUniqueInRoot = (root, selector) => {
        const matches = uniqueElements(Array.from(root.querySelectorAll(selector)));
        return matches.length === 1 ? matches[0] : null;
    };

    const findRootFromHostChain = (hostChain) => {
        if (!Array.isArray(hostChain) || hostChain.length === 0) {
            return document;
        }

        let currentRoot = document;
        for (const host of hostChain) {
            if (!host || typeof host.selector !== 'string') {
                return null;
            }

            const hostElement = findUniqueInRoot(currentRoot, host.selector);
            if (!hostElement || !hostElement.shadowRoot) {
                return null;
            }

            currentRoot = hostElement.shadowRoot;
        }

        return currentRoot;
    };

    const findElementByPredicate = (root, tag, predicate) => {
        const selector = tag && tag !== '*' ? tag : '*';
        const matches = uniqueElements(Array.from(root.querySelectorAll(selector)).filter(predicate));
        return matches.length === 1 ? matches[0] : null;
    };

    const findElementByFingerprint = (fingerprint) => {
        if (!fingerprint || typeof fingerprint !== 'object') {
            return null;
        }

        const root = findRootFromHostChain(fingerprint.hostChain);
        if (!root) {
            return null;
        }

        const tag = typeof fingerprint.tag === 'string' && fingerprint.tag
            ? fingerprint.tag.toLowerCase()
            : '*';

        const selectorCandidates = [];
        if (fingerprint.safeId) {
            selectorCandidates.push('#' + CSS.escape(fingerprint.safeId));
        }
        if (fingerprint.dataTestId) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[data-testid="' + CSS.escape(fingerprint.dataTestId) + '"]');
            selectorCandidates.push('[data-testid="' + CSS.escape(fingerprint.dataTestId) + '"]');
        }
        if (fingerprint.name) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[name="' + CSS.escape(fingerprint.name) + '"]');
        }
        if (fingerprint.placeholder) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[placeholder="' + CSS.escape(fingerprint.placeholder) + '"]');
        }
        if (fingerprint.ariaLabel) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[aria-label="' + CSS.escape(fingerprint.ariaLabel) + '"]');
        }
        if (Array.isArray(fingerprint.classTokens) && fingerprint.classTokens.length > 0 && tag !== '*') {
            selectorCandidates.push(tag + fingerprint.classTokens.map((token) => '.' + CSS.escape(token)).join(''));
        }
        if (fingerprint.role) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[role="' + CSS.escape(fingerprint.role) + '"]');
        }
        if (fingerprint.type && tag !== '*') {
            selectorCandidates.push(tag + '[type="' + CSS.escape(fingerprint.type) + '"]');
        }
        if (fingerprint.contentEditable && tag !== '*') {
            selectorCandidates.push(tag + '[contenteditable="true"]');
        }

        for (const selector of uniqueStrings(selectorCandidates)) {
            const element = findUniqueInRoot(root, selector);
            if (element && matchesClassTokens(element, fingerprint.classTokens)) {
                return {
                    element,
                    matchedSelector: selector,
                    strategy: 'fingerprint'
                };
            }
        }

        if (fingerprint.text) {
            const normalizedText = normalizeText(fingerprint.text);
            const element = findElementByPredicate(root, tag, (candidate) => {
                const text = normalizeText(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || candidate.getAttribute('title'));
                return text === normalizedText && matchesClassTokens(candidate, fingerprint.classTokens);
            });

            if (element) {
                return {
                    element,
                    matchedSelector: 'text:' + normalizedText,
                    strategy: 'fingerprint'
                };
            }
        }

        const descriptorElement = findElementByPredicate(root, tag, (candidate) => {
            if (fingerprint.role && candidate.getAttribute('role') !== fingerprint.role) return false;
            if (fingerprint.type && candidate.getAttribute('type') !== fingerprint.type) return false;
            if (fingerprint.contentEditable && !(candidate.isContentEditable || candidate.getAttribute('contenteditable') === 'true')) return false;
            if (fingerprint.name && candidate.getAttribute('name') !== fingerprint.name) return false;
            if (fingerprint.placeholder && candidate.getAttribute('placeholder') !== fingerprint.placeholder) return false;
            if (fingerprint.ariaLabel && candidate.getAttribute('aria-label') !== fingerprint.ariaLabel) return false;
            if (!matchesClassTokens(candidate, fingerprint.classTokens)) return false;
            return true;
        });

        if (descriptorElement) {
            return {
                element: descriptorElement,
                matchedSelector: 'fingerprint:descriptor',
                strategy: 'fingerprint'
            };
        }

        if (Array.isArray(fingerprint.localPath) && fingerprint.localPath.length > 0 && typeof root.querySelector === 'function') {
            const localSelector = fingerprint.localPath.join(' > ');
            const element = findUniqueInRoot(root, localSelector);
            if (element) {
                return {
                    element,
                    matchedSelector: localSelector,
                    strategy: 'fingerprint'
                };
            }
        }

        return null;
    };

    const isChatGptHost = () => {
        try {
            const h = (window.location.hostname || '').toLowerCase();
            return h === 'chatgpt.com' || h.endsWith('.chatgpt.com');
        } catch {
            return false;
        }
    };

    const isGeminiHost = () => {
        try {
            const h = (window.location.hostname || '').toLowerCase();
            return h === 'gemini.google.com' || h.endsWith('.gemini.google.com');
        } catch {
            return false;
        }
    };

    /**
     * Gems (/gems, özel Gem sohbetleri) ana /app arayüzünden farklı DOM kullanabiliyor.
     * Kayıtlı selektörler eşleşmezse alt bölgedeki composer’ı bul.
     */
    const tryGeminiComposerFallback = () => {
        if (!isGeminiHost()) {
            return null;
        }

        try {
            const quick = document.querySelector(
                'rich-textarea textarea, div.ql-editor[role="textbox"], textarea[placeholder*="Message" i], textarea[placeholder*="Ask" i], textarea[placeholder*="Gemini" i]'
            );
            if (quick && quick.isConnected) {
                const r = quick.getBoundingClientRect();
                const style = window.getComputedStyle(quick);
                if (
                    r.width >= 48 &&
                    r.height >= 12 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !quick.closest('header') &&
                    !quick.closest('[role="banner"]')
                ) {
                    return {
                        element: quick,
                        matchedSelector: 'gemini:known-pattern',
                        strategy: 'heuristic'
                    };
                }
            }
        } catch {
        }

        const vines = [];
        const roots = getSearchRoots();
        for (const root of roots) {
            try {
                root.querySelectorAll('textarea').forEach((el) => vines.push(el));
                root.querySelectorAll('[role="textbox"]').forEach((el) => vines.push(el));
                root.querySelectorAll('div[contenteditable="true"]').forEach((el) => vines.push(el));
            } catch {
            }
        }

        const candidates = uniqueElements(vines).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest('header') || el.closest('[role="banner"]')) return false;
            if (el.closest('[data-testid="modal"]') || el.closest('[data-state="open"][role="dialog"]')) {
                return false;
            }
            if (el.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
                return false;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 48 || r.height < 12) return false;
            if (r.bottom < -20 || r.top > window.innerHeight + 80) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        const scored = candidates.map((el) => {
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            const bottomScore = r.bottom + area * 1e-6;
            return { el, area, bottomScore };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.bottomScore - b.bottomScore) > 48) {
                return b.bottomScore - a.bottomScore;
            }
            return b.area - a.area;
        });

        const picked = scored[0].el;
        return {
            element: picked,
            matchedSelector: 'gemini:composer-fallback',
            strategy: 'heuristic'
        };
    };

    const tryGeminiButtonFallback = () => {
        if (!isGeminiHost()) {
            return null;
        }

        const vines = [];
        try {
            document.querySelectorAll('button.send-button').forEach((el) => vines.push(el));
            document.querySelectorAll('button[aria-label*="Send" i]').forEach((el) => vines.push(el));
            document.querySelectorAll('button[aria-label*="Gönder" i]').forEach((el) => vines.push(el));
            document.querySelectorAll('[role="button"][aria-label*="Send" i]').forEach((el) => vines.push(el));
            document.querySelectorAll('button[data-testid*="send" i]').forEach((el) => vines.push(el));
        } catch {
        }

        const candidates = uniqueElements(vines).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest('header') || el.closest('[role="banner"]')) return false;
            if (el.getAttribute('aria-disabled') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
                return false;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) return false;
            if (r.bottom < -20 || r.top > window.innerHeight + 120) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        const scored = candidates.map((el) => {
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            const bottomScore = r.bottom + area * 1e-6;
            return { el, area, bottomScore };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.bottomScore - b.bottomScore) > 32) {
                return b.bottomScore - a.bottomScore;
            }
            return b.area - a.area;
        });

        return {
            element: scored[0].el,
            matchedSelector: 'gemini:button-fallback',
            strategy: 'heuristic'
        };
    };

    /**
     * Project / GPT /g/.../c/... routes sometimes use a different DOM than the main chat view.
     * Saved selectors may not match or may be ambiguous — pick the main bottom composer heuristically.
     */
    const tryChatGptComposerFallback = () => {
        if (!isChatGptHost()) {
            return null;
        }

        try {
            const quick = document.querySelector(
                '#prompt-textarea, textarea[placeholder*="Message" i], textarea[placeholder*="Ask" i], [data-testid="composer-input"]'
            );
            if (quick && quick.isConnected) {
                const r = quick.getBoundingClientRect();
                const style = window.getComputedStyle(quick);
                if (
                    r.width >= 64 &&
                    r.height >= 14 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !quick.closest('header')
                ) {
                    return {
                        element: quick,
                        matchedSelector: 'chatgpt:known-pattern',
                        strategy: 'heuristic'
                    };
                }
            }
        } catch {
        }

        const vines = [];
        const roots = getSearchRoots();
        for (const root of roots) {
            try {
                root.querySelectorAll('textarea').forEach((el) => vines.push(el));
                root.querySelectorAll('[role="textbox"]').forEach((el) => vines.push(el));
            } catch {
            }
        }

        const candidates = uniqueElements(vines).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest('header') || el.closest('[role="banner"]')) return false;
            if (el.closest('[data-testid="modal"]') || el.closest('[data-state="open"][role="dialog"]')) {
                return false;
            }
            if (el.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
                return false;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 64 || r.height < 14) return false;
            if (r.bottom < -20 || r.top > window.innerHeight + 80) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        const scored = candidates.map((el) => {
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            const bottomScore = r.bottom + area * 1e-6;
            return { el, area, bottomScore };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.bottomScore - b.bottomScore) > 48) {
                return b.bottomScore - a.bottomScore;
            }
            return b.area - a.area;
        });

        const picked = scored[0].el;
        return {
            element: picked,
            matchedSelector: 'chatgpt:composer-fallback',
            strategy: 'heuristic'
        };
    };

    const queryElement = (lookup, kind, diagnostics) => {
        const cached = getCachedElement(kind, lookup, diagnostics);
        if (cached) {
            return cached;
        }

        const selectors = uniqueStrings(lookup && lookup.selectors);
        for (const selector of selectors) {
            const matched = findUniqueSelectorMatch(selector);
            if (matched.element) {
                cacheElement(kind, lookup, matched.matchedSelector, matched.element);
                diagnostics.strategy = matched.strategy;
                diagnostics.matchedSelector = matched.matchedSelector;
                return matched;
            }
        }

        const fingerprintMatch = findElementByFingerprint(lookup && lookup.fingerprint);
        if (fingerprintMatch && fingerprintMatch.element) {
            cacheElement(kind, lookup, fingerprintMatch.matchedSelector, fingerprintMatch.element);
            diagnostics.strategy = 'fingerprint';
            diagnostics.matchedSelector = fingerprintMatch.matchedSelector;
            return fingerprintMatch;
        }

        if (kind === 'input') {
            const chatgptFallback = tryChatGptComposerFallback();
            if (chatgptFallback && chatgptFallback.element) {
                cacheElement(kind, lookup, chatgptFallback.matchedSelector, chatgptFallback.element);
                diagnostics.strategy = chatgptFallback.strategy;
                diagnostics.matchedSelector = chatgptFallback.matchedSelector;
                return chatgptFallback;
            }
            const geminiInputFallback = tryGeminiComposerFallback();
            if (geminiInputFallback && geminiInputFallback.element) {
                cacheElement(kind, lookup, geminiInputFallback.matchedSelector, geminiInputFallback.element);
                diagnostics.strategy = geminiInputFallback.strategy;
                diagnostics.matchedSelector = geminiInputFallback.matchedSelector;
                return geminiInputFallback;
            }
        }

        if (kind === 'button') {
            const geminiButtonFallback = tryGeminiButtonFallback();
            if (geminiButtonFallback && geminiButtonFallback.element) {
                cacheElement(kind, lookup, geminiButtonFallback.matchedSelector, geminiButtonFallback.element);
                diagnostics.strategy = geminiButtonFallback.strategy;
                diagnostics.matchedSelector = geminiButtonFallback.matchedSelector;
                return geminiButtonFallback;
            }
        }

        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const findElement = (lookup, kind, diagnostics) => {
        const start = now();
        const result = queryElement(lookup, kind, diagnostics);
        diagnostics.durationMs = roundMs(diagnostics.durationMs + (now() - start));
        return result;
    };

    const triggerLifecycleEvents = (element) => {
        const events = ['focus', 'focusin', 'keydown', 'keypress', 'beforeinput', 'input', 'change', 'keyup', 'blur', 'focusout'];
        const options = { bubbles: true, cancelable: true, composed: true };
        events.forEach(name => {
            try {
                element.dispatchEvent(new Event(name, options));
            } catch {}
        });

        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue(element.value);
        }
    };

    const isReadyForInteraction = (element) => {
        if (!element) {
            return false;
        }

        const style = window.getComputedStyle(element);
        const isVisible = element.offsetWidth > 0
            && element.offsetHeight > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none';

        if (element.disabled) {
            return false;
        }
        if (element.getAttribute('disabled') !== null) {
            return false;
        }
        if (element.getAttribute('aria-disabled') === 'true') {
            return false;
        }

        const hasDisabledClass = Array.from(element.classList || []).some(className => {
            const normalized = String(className).toLowerCase();
            return normalized.includes('disabled') || normalized.includes('inactive');
        });

        return isVisible && !hasDisabledClass;
    };

    const waitForElement = async (lookup, kind, diagnostics, timeout = 10000, mustBeInteractive = false) => {
        const start = now();
        let attempts = 0;

        while (now() - start < timeout) {
            attempts += 1;
            const result = findElement(lookup, kind, diagnostics);
            const element = result.element;

            if (element && (!mustBeInteractive || isReadyForInteraction(element))) {
                diagnostics.waitIterations = attempts;
                diagnostics.interactiveRequired = mustBeInteractive;
                diagnostics.durationMs = roundMs(now() - start);
                return result;
            }

            if (element && result.matchedSelector) {
                invalidateCacheEntry(kind, lookup, diagnostics);
            }

            await wait(250);
        }

        diagnostics.waitIterations = attempts;
        diagnostics.interactiveRequired = mustBeInteractive;
        diagnostics.durationMs = roundMs(now() - start);
        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const resolveLookupError = (lookup, fallbackError, configHealth) => {
        if (lookup && lookup.fingerprint) {
            return 'selector_repick_required';
        }

        if (configHealth === 'needs_repick') {
            return 'selector_repick_required';
        }

        return fallbackError;
    };

    const hasLookup = (lookup) => uniqueStrings(lookup && lookup.selectors).length > 0 || Boolean(lookup && lookup.fingerprint);

    const getAncestors = (element) => {
        const ancestors = [];
        let current = element instanceof Element ? element : null;
        while (current) {
            ancestors.push(current);
            current = current.parentElement;
        }
        return ancestors;
    };

    const findCommonAncestor = (first, second) => {
        if (!(first instanceof Element) || !(second instanceof Element)) {
            return null;
        }

        const secondAncestors = new Set(getAncestors(second));
        for (const ancestor of getAncestors(first)) {
            if (secondAncestors.has(ancestor)) {
                return ancestor;
            }
        }

        return null;
    };

    const getComposerRoot = (inputElement, buttonElement) => {
        const scopedSelector = 'form, [role="form"], [data-testid*="composer" i], [data-testid*="prompt" i], [class*="composer" i], [class*="prompt" i]';
        if (buttonElement && typeof buttonElement.closest === 'function') {
            const root = buttonElement.closest(scopedSelector);
            if (root) return root;
        }

        if (inputElement && typeof inputElement.closest === 'function') {
            const root = inputElement.closest(scopedSelector);
            if (root) return root;
        }

        return findCommonAncestor(inputElement, buttonElement) || document.body;
    };

    const createActivityObserver = (root) => {
        const fallbackRoot = root instanceof Element || root instanceof DocumentFragment ? root : document.body;
        let lastMutationAt = now();
        let mutationCount = 0;
        const observer = new MutationObserver(() => {
            lastMutationAt = now();
            mutationCount += 1;
        });

        try {
            observer.observe(fallbackRoot, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true
            });
        } catch {
            observer.observe(document.body, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true
            });
        }

        return {
            disconnect: () => observer.disconnect(),
            getLastMutationAt: () => lastMutationAt,
            getMutationCount: () => mutationCount
        };
    };
`
}

function createScriptPreamble(
  kind: 'focus' | 'auto_send' | 'click_send' | 'validate' | 'submit_ready',
  config: SerializedAutomationConfig,
  includeButton = false
) {
  const ambiguousSelectorBehavior =
    kind === 'auto_send' || kind === 'click_send' ? 'pick' : 'reject'
  return `
    (async function() {
        ${buildCommonHelpers(ambiguousSelectorBehavior)}
        const scriptStartedAt = now();
        const config = ${JSON.stringify(config)};
        const diagnostics = createDiagnostics('${kind}', {
            inputSelector: uniqueStrings(config.input.selectors).join(', '),
            includeButton: ${includeButton},
            buttonSelector: uniqueStrings(config.button.selectors).join(', ')
        });
    `
}

export const generateFocusScript = (config: AutomationConfig): string => {
  const serialized = serializeAutomationConfig(config)

  return `
    ${createScriptPreamble('focus', serialized)}
        try {
            const result = await waitForElement(config.waitFor, 'input', diagnostics.input, 10000, false);
            const element = result.element;
            if (!element) {
                const error = resolveLookupError(config.waitFor, 'input_not_found', config.health);
                return {
                    success: false,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            element.focus();
            triggerLifecycleEvents(element);

            return {
                success: true,
                diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'focus_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'focus_failed'
                )
            };
        }
    })();
    `
}

export const generateAutoSendScript = (
  config: AutomationConfig,
  text: string,
  shouldSubmit: boolean = true,
  appendMode: boolean = false
): string => {
  const serialized = serializeAutomationConfig(config)
  const safeText = JSON.stringify(text)

  return `
    ${createScriptPreamble('auto_send', serialized, true)}
        const APPEND_TEXT_MODE = ${appendMode ? 'true' : 'false'};

        const setInputValue = async (element, value) => {
            const start = now();
            const doubleLinebreak = String.fromCharCode(10) + String.fromCharCode(10);
            try {
                if (element && typeof element.scrollIntoView === 'function') {
                    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            } catch {
            }
            element.focus();
            await wait(100);

            const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

            const collapseSelectionToEnd = () => {
                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(element);
                    range.collapse(false);
                    if (selection) {
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } catch {
                }
            };

            const resolveValueSetter = () => {
                const prototype = Object.getPrototypeOf(element);
                return Object.getOwnPropertyDescriptor(prototype, 'value') && Object.getOwnPropertyDescriptor(prototype, 'value').set
                    || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set)
                    || (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set);
            };

            if (!isContentEditable && APPEND_TEXT_MODE) {
                const valueSetter = resolveValueSetter();
                const current = String(element.value || '');
                const prefix = current.trim().length > 0 ? doubleLinebreak : '';
                const next = current + prefix + value;
                if (valueSetter) {
                    valueSetter.call(element, next);
                } else {
                    element.value = next;
                }
                triggerLifecycleEvents(element);
                diagnostics.setInputMs = roundMs(now() - start);
                return;
            }

            if (isContentEditable && APPEND_TEXT_MODE) {
                try {
                    collapseSelectionToEnd();
                    const hasContent = element.textContent && element.textContent.trim().length > 0;
                    const prefix = hasContent ? doubleLinebreak : '';
                    const payload = prefix + value;
                    if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, payload)) {
                        triggerLifecycleEvents(element);
                        diagnostics.setInputMs = roundMs(now() - start);
                        return;
                    }
                } catch {
                }
                try {
                    collapseSelectionToEnd();
                    if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, value)) {
                        triggerLifecycleEvents(element);
                        diagnostics.setInputMs = roundMs(now() - start);
                        return;
                    }
                } catch {
                }
                try {
                    collapseSelectionToEnd();
                    const hasContent = element.textContent && element.textContent.trim().length > 0;
                    const prefix = hasContent ? doubleLinebreak : '';
                    const payload = prefix + value;
                    element.dispatchEvent(new InputEvent('beforeinput', {
                        bubbles: true,
                        composed: true,
                        inputType: 'insertText',
                        data: payload
                    }));
                    element.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        composed: true,
                        inputType: 'insertText',
                        data: payload
                    }));
                } catch {
                }
                try {
                    const hasContent = element.textContent && element.textContent.trim().length > 0;
                    const prefix = hasContent ? doubleLinebreak : '';
                    const dt = new DataTransfer();
                    dt.setData('text/plain', prefix + value);
                    collapseSelectionToEnd();
                    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
                } catch {
                }
                triggerLifecycleEvents(element);
                diagnostics.setInputMs = roundMs(now() - start);
                return;
            }

            if (isContentEditable) {
                try {
                    if (typeof document.execCommand === 'function') {
                        document.execCommand('selectAll', false, null);
                        if (document.execCommand('insertText', false, value)) {
                            triggerLifecycleEvents(element);
                            diagnostics.setInputMs = roundMs(now() - start);
                            return;
                        }
                    }
                } catch {
                }

                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    selection && selection.removeAllRanges && selection.removeAllRanges();
                    range.selectNodeContents(element);
                    selection && selection.addRange && selection.addRange(range);

                    const inserted = typeof document.execCommand === 'function'
                        ? document.execCommand('insertText', false, value)
                        : false;

                    if (!inserted) {
                        throw new Error('exec_command_failed');
                    }
                } catch {
                    element.innerText = value;
                    if (element.innerHTML === '') {
                        element.innerHTML = value;
                    }

                    element.dispatchEvent(new InputEvent('beforeinput', {
                        bubbles: true,
                        composed: true,
                        inputType: 'insertText',
                        data: value
                    }));
                    element.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        composed: true,
                        inputType: 'insertText',
                        data: value
                    }));
                    try {
                        const dt = new DataTransfer();
                        dt.setData('text/plain', value);
                        element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
                    } catch {
                    }
                }
            } else {
                const valueSetter = resolveValueSetter();

                if (valueSetter) {
                    valueSetter.call(element, value);
                } else {
                    element.value = value;
                }
            }

            triggerLifecycleEvents(element);
            diagnostics.setInputMs = roundMs(now() - start);
        };

        const performSubmit = async (inputElement) => {
            const start = now();
            const mode = config.submitMode;
            let success = false;
            let error = null;

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(config.button, 'button', diagnostics.button, 15000, true);
                const button = buttonResult.element;

                if (button) {
                    button.click();
                    success = true;
                } else if (mode === 'click') {
                    error = resolveLookupError(config.button, 'button_not_found', config.health);
                }
            }

            if (!success && (mode === 'enter_key' || mode === 'mixed')) {
                inputElement.focus();
                const eventParams = {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                };
                inputElement.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                inputElement.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                inputElement.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                success = true;
            }

            diagnostics.submitMs = roundMs(now() - start);
            return {
                success,
                error
            };
        };

        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 10000, false);
            const inputElement = inputResult.element;
            if (!inputElement) {
                const error = resolveLookupError(config.input, 'input_not_found', config.health);
                return {
                    success: false,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            await setInputValue(inputElement, ${safeText});
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            await wait(500);
            const submitResult = await performSubmit(inputElement);
            return {
                success: submitResult.success,
                mode: config.submitMode,
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    submitResult.success ? null : (submitResult.error || 'submit_failed')
                ),
                ...(submitResult.success ? {} : { error: submitResult.error || 'submit_failed' })
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'script_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'script_failed'
                )
            };
        }
    })();
    `
}

export const generateClickSendScript = (config: AutomationConfig): string => {
  const serialized = serializeAutomationConfig(config)

  return `
    ${createScriptPreamble('click_send', serialized, true)}
        const performSubmit = async () => {
            const start = now();
            const mode = config.submitMode;
            let success = false;
            let error = null;

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(config.button, 'button', diagnostics.button, 15000, true);
                const button = buttonResult.element;

                if (button) {
                    button.click();
                    success = true;
                } else if (mode === 'click') {
                    error = resolveLookupError(config.button, 'button_not_found', config.health);
                }
            }

            if (!success && (mode === 'enter_key' || mode === 'mixed')) {
                const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 10000, false);
                const inputElement = inputResult.element;

                if (inputElement) {
                    inputElement.focus();
                    const eventParams = {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    };
                    inputElement.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                    inputElement.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                    inputElement.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                    success = true;
                } else {
                    error = resolveLookupError(config.input, 'input_not_found', config.health);
                }
            }

            diagnostics.submitMs = roundMs(now() - start);
            return {
                success,
                error
            };
        };

        try {
            const submitResult = await performSubmit();
            return {
                success: submitResult.success,
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    submitResult.success ? null : (submitResult.error || 'submit_failed')
                ),
                ...(submitResult.success ? {} : { error: submitResult.error || 'submit_failed' })
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'click_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'click_failed'
                )
            };
        }
    })();
    `
}

export const generateWaitForSubmitReadyScript = (
  config: AutomationConfig,
  options: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number } = {}
): string => {
  const serialized = serializeAutomationConfig(config)
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? Math.round(options.timeoutMs)
      : 15000
  const settleMs =
    typeof options.settleMs === 'number' && options.settleMs >= 0
      ? Math.round(options.settleMs)
      : 1200
  const minimumWaitMs =
    typeof options.minimumWaitMs === 'number' && options.minimumWaitMs >= 0
      ? Math.round(options.minimumWaitMs)
      : 1000

  return `
    ${createScriptPreamble('submit_ready', serialized, true)}
        try {
            const buttonConfigured = config.submitMode !== 'enter_key' && hasLookup(config.button);
            if (buttonConfigured && diagnostics.button) {
                diagnostics.button.interactiveRequired = true;
            } else {
                diagnostics.input.interactiveRequired = true;
            }
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 10000, false);
            const inputElement = inputResult.element;

            if (!inputElement) {
                const error = resolveLookupError(config.input, 'input_not_found', config.health);
                return {
                    success: false,
                    action: 'submit_ready',
                    mode: config.submitMode,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            const buttonResult = buttonConfigured
                ? await waitForElement(config.button, 'button', diagnostics.button, 10000, false)
                : { element: null };
            const buttonElement = buttonResult.element;

            if (buttonConfigured && !buttonElement) {
                const error = resolveLookupError(config.button, 'button_not_found', config.health);
                return {
                    success: false,
                    action: 'submit_ready',
                    mode: config.submitMode,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            const root = getComposerRoot(inputElement, buttonElement);
            const observer = createActivityObserver(root);
            const waitStartedAt = now();

            try {
                while (now() - waitStartedAt < ${timeoutMs}) {
                    const targetDiagnostics = buttonConfigured ? diagnostics.button : diagnostics.input;
                    const targetLookup = buttonConfigured ? config.button : config.input;
                    const targetKind = buttonConfigured ? 'button' : 'input';
                    const targetResult = findElement(targetLookup, targetKind, targetDiagnostics);
                    const targetElement = targetResult.element;
                    const isInteractive = Boolean(targetElement && isReadyForInteraction(targetElement));
                    const settledForMs = now() - observer.getLastMutationAt();
                    const waitedMs = now() - waitStartedAt;

                    if (isInteractive && waitedMs >= ${minimumWaitMs} && settledForMs >= ${settleMs}) {
                        diagnostics.submitMs = roundMs(waitedMs);
                        return {
                            success: true,
                            action: 'submit_ready',
                            mode: config.submitMode,
                            diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                        };
                    }

                    await wait(250);
                }
            } finally {
                observer.disconnect();
            }

            const targetDiagnostics = buttonConfigured ? diagnostics.button : diagnostics.input;
            const targetLookup = buttonConfigured ? config.button : config.input;
            const targetKind = buttonConfigured ? 'button' : 'input';
            const targetResult = findElement(targetLookup, targetKind, targetDiagnostics);
            const error = targetResult.element
                ? 'submit_not_ready'
                : resolveLookupError(targetLookup, buttonConfigured ? 'button_not_found' : 'input_not_found', config.health);

            diagnostics.submitMs = roundMs(now() - waitStartedAt);
            return {
                success: false,
                action: 'submit_ready',
                mode: config.submitMode,
                error,
                diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
            };
        } catch (error) {
            return {
                success: false,
                action: 'submit_ready',
                error: error instanceof Error ? error.message : 'submit_not_ready',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'submit_not_ready'
                )
            };
        }
    })();
    `
}

export const generateValidateSelectorsScript = (config: AutomationConfig): string => {
  const serialized = serializeAutomationConfig(config)

  return `
    ${createScriptPreamble('validate', serialized, true)}
        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 2000, false);
            const buttonResult = await waitForElement(config.button, 'button', diagnostics.button, 2000, true);
            const inputFound = Boolean(inputResult.element);
            const buttonFound = Boolean(buttonResult.element);
            const error = !inputFound
                ? resolveLookupError(config.input, 'input_not_found', config.health)
                : (!buttonFound ? resolveLookupError(config.button, 'button_not_found', config.health) : null);

            return {
                success: inputFound && buttonFound,
                action: 'validate',
                mode: config.submitMode,
                diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error),
                ...(error ? { error } : {})
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'validate_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'validate_failed'
                )
            };
        }
    })();
    `
}
