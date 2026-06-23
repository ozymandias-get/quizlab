export function buildHumanTypingScript(): string {
  return `
        const humanType = async (element, value, delayMs = 30) => {
            const start = now();
            const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            element.focus();
            await wait(100);

            if (isContentEditable) {
                try {
                    document.execCommand('selectAll', false, null);
                } catch {}
            } else if (typeof element.select === 'function') {
                element.select();
            }

            for (let i = 0; i < value.length; i++) {
                const char = value[i];

                if (isContentEditable) {
                    try {
                        document.execCommand('insertText', false, char);
                    } catch {
                        element.dispatchEvent(new InputEvent('beforeinput', {
                            bubbles: true, composed: true, inputType: 'insertText', data: char
                        }));
                        element.textContent = (element.textContent || '') + char;
                        element.dispatchEvent(new InputEvent('input', {
                            bubbles: true, composed: true, inputType: 'insertText', data: char
                        }));
                    }
                } else {
                    const proto = Object.getPrototypeOf(element);
                    const valueSetter = (Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set)
                        || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set)
                        || (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set);
                    const current = String(element.value || '');
                    if (valueSetter) {
                        valueSetter.call(element, current + char);
                    } else {
                        element.value = current + char;
                    }
                }

                element.dispatchEvent(new InputEvent('input', {
                    bubbles: true, composed: true, inputType: 'insertText', data: char
                }));

                if (i < value.length - 1) {
                    await wait(delayMs);
                }
            }

            triggerLifecycleEvents(element);
            diagnostics.setInputMs = roundMs(now() - start);
        };
  `
}
