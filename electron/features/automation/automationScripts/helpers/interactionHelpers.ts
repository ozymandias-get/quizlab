export const interactionHelpers = `    const queryElement = (lookup, kind, diagnostics) => {
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
\n`
