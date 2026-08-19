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

            const insertTextAtCaret = (target, text) => {
                try {
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const container = range.commonAncestorContainer;
                        if (container === target || (target.contains && target.contains(container))) {
                            range.deleteContents();
                            const node = document.createTextNode(text);
                            range.insertNode(node);
                            range.setStartAfter(node);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                            return true;
                        }
                    }
                } catch {
                }
                try {
                    const node = document.createTextNode(text);
                    target.appendChild(node);
                    return true;
                } catch {
                    return false;
                }
            };

            const replaceContent = (target, text) => {
                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    selection && selection.removeAllRanges && selection.removeAllRanges();
                    range.selectNodeContents(target);
                    range.deleteContents();
                    const node = document.createTextNode(text);
                    range.insertNode(node);
                    range.collapse(false);
                    selection && selection.addRange && selection.addRange(range);
                    return true;
                } catch {
                    return false;
                }
            };

            const resolveValueSetter = () => {
                const prototype = Object.getPrototypeOf(element);
                return Object.getOwnPropertyDescriptor(prototype, 'value') && Object.getOwnPropertyDescriptor(prototype, 'value').set
                    || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set)
                    || (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set);
            };

            const dispatchBeforeInput = (data) => {
                try {
                    element.dispatchEvent(new InputEvent('beforeinput', {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        inputType: 'insertText',
                        data: data
                    }));
                } catch {
                }
            };

            if (!isContentEditable && APPEND_TEXT_MODE) {
                const valueSetter = resolveValueSetter();
                const current = String(element.value || '');
                const prefix = current.trim().length > 0 ? doubleLinebreak : '';
                const next = current + prefix + value;
                dispatchBeforeInput(next);
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
                    // Sentetik beforeinput: ProseMirror/Lexical gibi framework'ler
                    // bunu işleyip kendi modelini günceller. İşlenmediyse DOM'a
                    // manuel yazım yapılır. Paste event'i bilinçli olarak atlanır:
                    // beforeinput'u işleyen editörlerde çift eklemeye yol açardı.
                    element.dispatchEvent(new InputEvent('beforeinput', {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        inputType: 'insertText',
                        data: payload
                    }));
                    await wait(0);
                    const applied = (element.textContent || '').includes(payload);
                    if (!applied) {
                        insertTextAtCaret(element, payload);
                    }
                    element.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        composed: true,
                        inputType: 'insertText',
                        data: payload
                    }));
                } catch {
                    insertTextAtCaret(element, (element.textContent && element.textContent.trim().length > 0 ? doubleLinebreak : '') + value);
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

                    if (inserted) {
                        triggerLifecycleEvents(element);
                        diagnostics.setInputMs = roundMs(now() - start);
                        return;
                    }
                } catch {
                }

                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    selection && selection.removeAllRanges && selection.removeAllRanges();
                    range.selectNodeContents(element);
                    selection && selection.addRange && selection.addRange(range);

                    element.dispatchEvent(new InputEvent('beforeinput', {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        inputType: 'insertText',
                        data: value
                    }));
                    await wait(0);
                    const applied = (element.textContent || '').includes(value);
                    if (!applied) {
                        replaceContent(element, value);
                    }
                    element.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        composed: true,
                        inputType: 'insertText',
                        data: value
                    }));
                } catch {
                    replaceContent(element, value);
                }
            } else {
                const valueSetter = resolveValueSetter();
                dispatchBeforeInput(value);
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
