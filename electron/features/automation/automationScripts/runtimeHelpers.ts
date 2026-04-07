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

export { buildCommonHelpers }
