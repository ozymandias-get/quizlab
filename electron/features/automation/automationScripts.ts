/**
 * AI Automation Script Generator
 * Generates safe JavaScript code for webview execution
 */
import type { AutomationConfig } from '@shared/types'

// Re-export for backward compatibility
export type { AutomationConfig }


const COMMON_HELPERS = `
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const findElement = (selector) => {
        if (!selector) return null;
        const subSelectors = selector.split(',').map(s => s.trim()).filter(s => s);
        
        const findRecursive = (root, sel) => {
            const el = root.querySelector(sel);
            if (el) return el;
            
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.shadowRoot) {
                    const found = findRecursive(node.shadowRoot, sel);
                    if (found) return found;
                }
            }
            return null;
        };

        for (const sel of subSelectors) {
            const found = findRecursive(document, sel);
            if (found) return found;
        }
        return null;
    };

    const triggerLifecycleEvents = (element) => {
        const events = ['focus', 'focusin', 'keydown', 'keypress', 'beforeinput', 'input', 'change', 'keyup', 'blur', 'focusout'];
        const options = { bubbles: true, cancelable: true, composed: true };
        events.forEach(name => {
            try { element.dispatchEvent(new Event(name, options)); } catch (e) {}
        });
        const tracker = element._valueTracker;
        if (tracker) tracker.setValue(element.value);
    };

    const isReadyForInteraction = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        
        // Disabled Check
        if (el.disabled) return false;
        if (el.getAttribute('disabled') !== null) return false;
        if (el.getAttribute('aria-disabled') === 'true') return false;
        
        // Class-based Disabled Check (common in frameworks)
        const hasDisabledClass = Array.from(el.classList).some(cls => {
            const lower = cls.toLowerCase();
            return lower.includes('disabled') || lower.includes('inactive');
        });
        
        return isVisible && !hasDisabledClass;
    };
`;

export const generateFocusScript = (config: AutomationConfig): string => {
    const inputSelector = JSON.stringify(config.input || config.waitFor || '');
    return `
    (async function() {
        ${COMMON_HELPERS}
        const el = findElement(${inputSelector});
        if (el) {
            el.focus();
            triggerLifecycleEvents(el);
            return true;
        }
        return false;
    })();
    `;
}

export const generateAutoSendScript = (config: AutomationConfig, text: string, shouldSubmit: boolean = true): string => {
    const inputSelector = JSON.stringify(config.input || '');
    const buttonSelector = JSON.stringify(config.button || '');
    const submitMode = config.submitMode || 'click';
    const safeText = JSON.stringify(text);

    return `
    (async function() {
        ${COMMON_HELPERS}

        const waitForElement = async (selector, timeout = 10000, mustBeInteractive = false) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = findElement(selector);
                if (el && (!mustBeInteractive || isReadyForInteraction(el))) return el;
                await wait(250);
            }
            return null;
        };

        const setInputValue = async (element, value) => {
            element.focus();
            await wait(100);

            const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

            if (isContentEditable) {
                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    selection.removeAllRanges();
                    range.selectNodeContents(element);
                    selection.addRange(range);
                    if (!document.execCommand('insertText', false, value)) throw new Error();
                } catch (e) {
                    element.innerText = value;
                    if (element.innerHTML === '') element.innerHTML = value;
                    element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
                    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
                }
            } else {
                const prototype = Object.getPrototypeOf(element);
                const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set 
                    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set 
                    || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                if (valueSetter) valueSetter.call(element, value);
                else element.value = value;
            }
            triggerLifecycleEvents(element);
        };

        const performSubmit = async (inputEl) => {
            const mode = '${submitMode}';
            let success = false;

            if (mode === 'click' || mode === 'mixed') {
                // Wait for button to be truly INTERACTIVE (e.g. not disabled while uploading)
                const btn = await waitForElement(${buttonSelector}, 15000, true);
                if (btn) { btn.click(); success = true; }
            }

            if (!success && (mode === 'enter_key' || mode === 'mixed')) {
                inputEl.focus();
                const eventParams = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
                inputEl.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                inputEl.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                inputEl.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                success = true;
            }

            return success;
        };

        try {
            const inputEl = await waitForElement(${inputSelector});
            if (!inputEl) return { success: false, error: 'input_not_found' };

            await setInputValue(inputEl, ${safeText});
            if (!${shouldSubmit}) return { success: true, action: 'input_only', mode: '${submitMode}' };

            await wait(500);
            const isSent = await performSubmit(inputEl);
            return { success: isSent, mode: '${submitMode}' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    })();
    `;
}

export const generateClickSendScript = (config: AutomationConfig): string => {
    const inputSelector = JSON.stringify(config.input || '');
    const buttonSelector = JSON.stringify(config.button || '');
    const submitMode = config.submitMode || 'click';

    return `
    (async function() {
        ${COMMON_HELPERS}

        const waitForElement = async (selector, timeout = 10000, mustBeInteractive = false) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = findElement(selector);
                if (el && (!mustBeInteractive || isReadyForInteraction(el))) return el;
                await wait(250);
            }
            return null;
        };

        const performSubmit = async () => {
            const mode = '${submitMode}';
            let success = false;

            if (mode === 'click' || mode === 'mixed') { 
                const btn = await waitForElement(${buttonSelector}, 15000, true);
                if (btn) { btn.click(); success = true; }
            }

            if (!success && (mode === 'enter_key' || mode === 'mixed')) {
                const inputEl = findElement(${inputSelector});
                if (inputEl) {
                    inputEl.focus();
                    const eventParams = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
                    inputEl.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                    inputEl.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                    inputEl.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                    success = true;
                }
            }

            return success;
        };

        return await performSubmit();
    })();
    `;
}
