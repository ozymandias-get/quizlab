export function buildHumanTypingScript(): string {
  return `
        const humanType = async (element, value, delayMs = 30, appendMode = false) => {
            const start = now();
            const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
            const doubleLinebreak = String.fromCharCode(10) + String.fromCharCode(10);

            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            element.focus();
            await wait(100);

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

            if (isContentEditable) {
                if (appendMode) {
                    // Append: mevcut içerik korunur, imleç sona alınır —
                    // selectAll kullanıcının önceki taslağını silerdi.
                    collapseSelectionToEnd();
                } else {
                    try {
                        document.execCommand('selectAll', false, null);
                    } catch {}
                }
            } else if (!appendMode && typeof element.select === 'function') {
                element.select();
            }

            // Append modunda dolu alana ayırıcı eklenir (setInputValue ile aynı
            // sözleşme) ki metin önceki taslağa yapışmasın. Replace modunda
            // non-CE alanlarda tampon boş başlar: ilk karakter yazıldığında
            // eski değerin tamamı değiştirilir (value setter selection'ı yok
            // sayar; eski davranış taslağın sonuna ekliyordu).
            let existing = '';
            if (appendMode) {
                existing = isContentEditable ? (element.textContent || '') : String(element.value || '');
            }
            const prefix = appendMode && existing.trim().length > 0 ? doubleLinebreak : '';
            const typedBuffer = { value: '' };

            // Iterate code points (not UTF-16 units) so astral characters
            // such as emoji are typed whole instead of as lone surrogates.
            const chars = Array.from(prefix + value);
            for (let i = 0; i < chars.length; i++) {
                // Cooperative cancellation. Typing is one character per
                // delayMs, so a large prompt can run for many minutes; without
                // this the injected promise never settles and every later send
                // queued behind it on the same managed view is blocked too. The rest
                // of the runtime (selectorEngine, __eventDrivenWait) honours
                // the same flag. isAborted comes from the baseHelpers preamble.
                if (typeof isAborted === 'function' && isAborted()) {
                    return;
                }

                const char = chars[i];

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
                    const current = appendMode ? String(element.value || '') : typedBuffer.value;
                    const next = current + char;
                    if (valueSetter) {
                        valueSetter.call(element, next);
                    } else {
                        element.value = next;
                    }
                    typedBuffer.value = next;
                }

                element.dispatchEvent(new InputEvent('input', {
                    bubbles: true, composed: true, inputType: 'insertText', data: char
                }));

                if (i < chars.length - 1) {
                    await wait(delayMs);
                }
            }

            triggerLifecycleEvents(element);
            diagnostics.textInputStrategy = 'human_typing';
            diagnostics.setInputMs = roundMs(now() - start);
        };
  `
}
