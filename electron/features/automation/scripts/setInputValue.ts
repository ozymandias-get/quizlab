export function buildSetInputValueScript(): string {
  return `
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
`
}
