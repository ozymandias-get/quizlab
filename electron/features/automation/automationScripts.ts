/**
 * AI Automation Script Generator
 * Generates safe JavaScript code for webview execution.
 */
import type { AutomationConfig } from '@shared-core/types'

export type { AutomationConfig }

const COMMON_HELPERS = `
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now());
    const roundMs = (value) => Math.round(value * 100) / 100;

    const splitSelectors = (selector) => (typeof selector === 'string' ? selector : '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);

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
        const cacheKey = '__quizlabAutomationCache';
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

    const getCacheEntry = (kind, selector) => {
        const normalizedSelector = (selector || '').trim();
        const cache = getAutomationCache();
        const key = kind + '::' + normalizedSelector;

        if (!cache.elements[key]) {
            cache.elements[key] = {
                element: null,
                matchedSelector: null
            };
        }

        return cache.elements[key];
    };

    const invalidateCacheEntry = (kind, selector, diagnostics) => {
        const entry = getCacheEntry(kind, selector);
        if (!entry.element && !entry.matchedSelector) {
            return;
        }

        entry.element = null;
        entry.matchedSelector = null;
        if (diagnostics) {
            diagnostics.cacheInvalidations += 1;
        }
    };

    const getCachedElement = (kind, selector, diagnostics) => {
        const entry = getCacheEntry(kind, selector);
        const element = entry.element;

        if (element && element.isConnected !== false) {
            diagnostics.cacheHits += 1;
            diagnostics.strategy = 'cache';
            diagnostics.matchedSelector = entry.matchedSelector || selector || null;
            return {
                element,
                matchedSelector: diagnostics.matchedSelector,
                strategy: 'cache'
            };
        }

        if (entry.element || entry.matchedSelector) {
            invalidateCacheEntry(kind, selector, diagnostics);
        }

        return null;
    };

    const cacheElement = (kind, selector, matchedSelector, element) => {
        const entry = getCacheEntry(kind, selector);
        entry.element = element || null;
        entry.matchedSelector = matchedSelector || selector || null;
    };

    const findRecursive = (root, selector, skipDirect = false) => {
        if (!skipDirect && typeof root.querySelector === 'function') {
            const direct = root.querySelector(selector);
            if (direct) {
                return direct;
            }
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node && node.shadowRoot) {
                const found = findRecursive(node.shadowRoot, selector, false);
                if (found) {
                    return found;
                }
            }
        }

        return null;
    };

    const queryElement = (selectors, kind, diagnostics) => {
        const normalizedSelectors = splitSelectors(selectors);

        for (const selector of normalizedSelectors) {
            const cached = getCachedElement(kind, selector, diagnostics);
            if (cached) {
                return cached;
            }

            const direct = document.querySelector(selector);
            if (direct) {
                cacheElement(kind, selector, selector, direct);
                diagnostics.strategy = 'direct';
                diagnostics.matchedSelector = selector;
                return {
                    element: direct,
                    matchedSelector: selector,
                    strategy: 'direct'
                };
            }

            const recursive = findRecursive(document, selector, true);
            if (recursive) {
                cacheElement(kind, selector, selector, recursive);
                diagnostics.strategy = 'recursive';
                diagnostics.matchedSelector = selector;
                return {
                    element: recursive,
                    matchedSelector: selector,
                    strategy: 'recursive'
                };
            }
        }

        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const findElement = (selectors, kind, diagnostics) => {
        const start = now();
        const result = queryElement(selectors, kind, diagnostics);
        diagnostics.durationMs = roundMs(diagnostics.durationMs + (now() - start));
        return result;
    };

    const triggerLifecycleEvents = (element) => {
        const events = ['focus', 'focusin', 'keydown', 'keypress', 'beforeinput', 'input', 'change', 'keyup', 'blur', 'focusout'];
        const options = { bubbles: true, cancelable: true, composed: true };
        events.forEach(name => {
            try {
                element.dispatchEvent(new Event(name, options));
            } catch {
                // Ignore lifecycle dispatch failures on third-party pages.
            }
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

        const hasDisabledClass = Array.from(element.classList).some(className => {
            const normalized = String(className).toLowerCase();
            return normalized.includes('disabled') || normalized.includes('inactive');
        });

        return isVisible && !hasDisabledClass;
    };

    const waitForElement = async (selectors, kind, diagnostics, timeout = 10000, mustBeInteractive = false) => {
        const start = now();
        let attempts = 0;

        while (now() - start < timeout) {
            attempts += 1;
            const result = findElement(selectors, kind, diagnostics);
            const element = result.element;

            if (element && (!mustBeInteractive || isReadyForInteraction(element))) {
                diagnostics.waitIterations = attempts;
                diagnostics.interactiveRequired = mustBeInteractive;
                diagnostics.durationMs = roundMs(now() - start);
                return result;
            }

            if (element && result.matchedSelector) {
                invalidateCacheEntry(kind, result.matchedSelector, diagnostics);
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
`;

export const generateFocusScript = (config: AutomationConfig): string => {
    const inputSelector = JSON.stringify(config.input || config.waitFor || '');

    return `
    (async function() {
        ${COMMON_HELPERS}
        const scriptStartedAt = now();
        const diagnostics = createDiagnostics('focus', {
            inputSelector: ${inputSelector}
        });

        try {
            const result = await waitForElement(${inputSelector}, 'input', diagnostics.input, 10000, false);
            const element = result.element;
            if (!element) {
                return {
                    success: false,
                    error: 'input_not_found',
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, 'input_not_found')
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
    `;
};

export const generateAutoSendScript = (config: AutomationConfig, text: string, shouldSubmit: boolean = true): string => {
    const inputSelector = JSON.stringify(config.input || '');
    const buttonSelector = JSON.stringify(config.button || '');
    const submitMode = config.submitMode || 'click';
    const safeText = JSON.stringify(text);

    return `
    (async function() {
        ${COMMON_HELPERS}
        const scriptStartedAt = now();
        const diagnostics = createDiagnostics('auto_send', {
            inputSelector: ${inputSelector},
            includeButton: true,
            buttonSelector: ${buttonSelector}
        });

        const setInputValue = async (element, value) => {
            const start = now();
            element.focus();
            await wait(100);

            const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

            if (isContentEditable) {
                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    selection?.removeAllRanges?.();
                    range.selectNodeContents(element);
                    selection?.addRange?.(range);

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
                }
            } else {
                const prototype = Object.getPrototypeOf(element);
                const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
                    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                    || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

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
            const mode = '${submitMode}';
            let success = false;

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(${buttonSelector}, 'button', diagnostics.button, 15000, true);
                const button = buttonResult.element;

                if (button) {
                    button.click();
                    success = true;
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
            return success;
        };

        try {
            const inputResult = await waitForElement(${inputSelector}, 'input', diagnostics.input, 10000, false);
            const inputElement = inputResult.element;
            if (!inputElement) {
                return {
                    success: false,
                    error: 'input_not_found',
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, 'input_not_found')
                };
            }

            await setInputValue(inputElement, ${safeText});
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: '${submitMode}',
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            await wait(500);
            const submitted = await performSubmit(inputElement);
            return {
                success: submitted,
                mode: '${submitMode}',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    submitted ? null : 'submit_failed'
                ),
                ...(submitted ? {} : { error: 'submit_failed' })
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
    `;
};

export const generateClickSendScript = (config: AutomationConfig): string => {
    const inputSelector = JSON.stringify(config.input || '');
    const buttonSelector = JSON.stringify(config.button || '');
    const submitMode = config.submitMode || 'click';

    return `
    (async function() {
        ${COMMON_HELPERS}
        const scriptStartedAt = now();
        const diagnostics = createDiagnostics('click_send', {
            inputSelector: ${inputSelector},
            includeButton: true,
            buttonSelector: ${buttonSelector}
        });

        const performSubmit = async () => {
            const start = now();
            const mode = '${submitMode}';
            let success = false;

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(${buttonSelector}, 'button', diagnostics.button, 15000, true);
                const button = buttonResult.element;

                if (button) {
                    button.click();
                    success = true;
                }
            }

            if (!success && (mode === 'enter_key' || mode === 'mixed')) {
                const inputResult = await waitForElement(${inputSelector}, 'input', diagnostics.input, 10000, false);
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
                }
            }

            diagnostics.submitMs = roundMs(now() - start);
            return success;
        };

        try {
            const success = await performSubmit();
            return {
                success,
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    success ? null : 'submit_failed'
                ),
                ...(success ? {} : { error: 'submit_failed' })
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
    `;
};
