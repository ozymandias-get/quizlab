export const interactionHelpers = `    const queryElement = (lookup, kind, diagnostics, config) => {
        return queryElementWithPipeline(lookup, kind, diagnostics, config, 0);
    };

    const findElement = (lookup, kind, diagnostics, config) => {
        const start = now();
        const result = queryElement(lookup, kind, diagnostics, config);
        diagnostics.durationMs = roundMs(diagnostics.durationMs + (now() - start));
        return result;
    };

    const waitForElement = async (lookup, kind, diagnostics, config, timeout = 10000, mustBeInteractive = false) => {
        return resolveWithFallback(lookup, kind, diagnostics, config, timeout, mustBeInteractive);
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
            getLastMutationAt: () => lastMutationAt
        };
    };
\n`
