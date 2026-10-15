export function buildSetInputValueScript(): string {
  return `
        const setInputValue = async (element, value) => {
            const start = now();
            const doubleLinebreak = String.fromCharCode(10) + String.fromCharCode(10);

            // Metnin alana hangi mekanizmayla girdiği ve ne kadar sürdüğü tek
            // noktadan işlenir; her başarılı strateji çağırır.
            const finishInput = (strategy) => {
                diagnostics.textInputStrategy = strategy;
                diagnostics.setInputMs = roundMs(now() - start);
            };

            // ── Large-text threshold ────────────────────────────────────────
            // ProseMirror/Lexical editors (Claude/ChatGPT) lock up when a very
            // long payload is pushed through execCommand('insertText') in a
            // single synchronous call — their AST rebuild blocks the main
            // thread and Chromium hits the script timeout, dropping or
            // corrupting characters. Above this threshold we switch to a
            // synthetic paste event (the editor's native bulk-insert path),
            // which is designed to ingest large payloads in one pass.
            const LARGE_TEXT_THRESHOLD = 2000;

            const buildDataTransfer = (text) => {
                try {
                    const dt = new DataTransfer();
                    dt.setData('text/plain', text);
                    dt.setData('text/html', text.replace(/\\n/g, '<br>'));
                    return dt;
                } catch (_) {
                    return null;
                }
            };

            const dispatchSyntheticPaste = (target, text) => {
                const dt = buildDataTransfer(text);
                const options = dt
                    ? { bubbles: true, cancelable: true, composed: true, clipboardData: dt }
                    : { bubbles: true, cancelable: true, composed: true };
                const evt = new ClipboardEvent('paste', options);
                // Marked so the app's clipboard protection (security.ts) lets
                // this event through — the payload travels in clipboardData
                // and never reads from the real system clipboard.
                evt.__quizlabInternalPaste = true;
                target.dispatchEvent(evt);
                return true;
            };

            const pasteLargeText = async (target, text, prefix) => {
                const payload = (prefix || '') + text;

                const dispatchBeforeInput = (data) => {
                    try {
                        target.dispatchEvent(new InputEvent('beforeinput', {
                            bubbles: true,
                            cancelable: true,
                            composed: true,
                            inputType: 'insertFromPaste',
                            data: data
                        }));
                    } catch (_) {}
                };

                // System clipboard is deliberately NOT touched here: the
                // payload travels in ClipboardEvent.clipboardData and the
                // user's clipboard must not be silently overwritten by a
                // fire-and-forget write (it could even land after the image
                // restore and leave the wrong content behind).
                dispatchSyntheticPaste(target, payload);
                await wait(50);
                // Editörler metni normalize eder (blok sınırındaki çift satır
                // sonu tek satır sonuna dönüşebilir, görünmez karakterler
                // eklenebilir); örnek normalize edilerek karşılaştırılır.
                const sample = normalizeForCompare(payload).substring(0, 40);
                const readTarget = () => normalizeForCompare((target.textContent || '') + ' ' + (target.innerText || ''));
                const applied = sample.length > 0 && readTarget().includes(sample);
                if (applied) return 'synthetic_paste';

                // Paste was not consumed (editor ignored the synthetic event).
                // Fall back to a chunked beforeinput + DOM insertion so the
                // work is spread across microtasks instead of one giant call.
                dispatchBeforeInput(payload);
                await wait(0);
                const reApplied = sample.length > 0 && normalizeForCompare(target.textContent || '').includes(sample);
                if (reApplied) return 'beforeinput';

                try {
                    const node = document.createTextNode(payload);
                    target.appendChild(node);
                    return 'dom_insert';
                } catch (_) {
                    return null;
                }
            };

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
                finishInput('value_setter');
                return;
            }

            if (isContentEditable && APPEND_TEXT_MODE) {
                try {
                    collapseSelectionToEnd();
                    const hasContent = element.textContent && element.textContent.trim().length > 0;
                    const prefix = hasContent ? doubleLinebreak : '';
                    if (value.length > LARGE_TEXT_THRESHOLD) {
                        const pastedAs = await pasteLargeText(element, value, prefix);
                        if (pastedAs) {
                            triggerLifecycleEvents(element);
                            finishInput(pastedAs);
                            return;
                        }
                    }
                    const payload = prefix + value;
                    if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, payload)) {
                        triggerLifecycleEvents(element);
                        finishInput('exec_command');
                        return;
                    }
                } catch {
                }
                try {
                    collapseSelectionToEnd();
                    if (value.length > LARGE_TEXT_THRESHOLD) {
                        const pastedAs = await pasteLargeText(element, value, '');
                        if (pastedAs) {
                            triggerLifecycleEvents(element);
                            finishInput(pastedAs);
                            return;
                        }
                    }
                    if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, value)) {
                        triggerLifecycleEvents(element);
                        finishInput('exec_command');
                        return;
                    }
                } catch {
                }
                let strategy = 'dom_insert';
                try {
                    collapseSelectionToEnd();
                    const hasContent = element.textContent && element.textContent.trim().length > 0;
                    const prefix = hasContent ? doubleLinebreak : '';
                    if (value.length > LARGE_TEXT_THRESHOLD) {
                        const pastedAs = await pasteLargeText(element, value, prefix);
                        if (pastedAs) {
                            triggerLifecycleEvents(element);
                            finishInput(pastedAs);
                            return;
                        }
                    }
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
                    const normalizedPayload = normalizeForCompare(payload);
                    const applied = normalizedPayload.length > 0
                        && normalizeForCompare(element.textContent || '').includes(normalizedPayload);
                    if (applied) {
                        strategy = 'beforeinput';
                    } else {
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
                finishInput(strategy);
                return;
            }

            let strategy = 'dom_insert';
            if (isContentEditable) {
                if (value.length > LARGE_TEXT_THRESHOLD) {
                    // Select everything first so the synthetic paste replaces the
                    // existing content instead of appending to it.
                    try {
                        const sel = window.getSelection();
                        const r = document.createRange();
                        sel && sel.removeAllRanges && sel.removeAllRanges();
                        r.selectNodeContents(element);
                        sel && sel.addRange && sel.addRange(r);
                    } catch (_) {}
                    const pastedAs = await pasteLargeText(element, value, '');
                    if (pastedAs) {
                        triggerLifecycleEvents(element);
                        finishInput(pastedAs);
                        return;
                    }
                }
                try {
                    if (typeof document.execCommand === 'function') {
                        document.execCommand('selectAll', false, null);
                        if (document.execCommand('insertText', false, value)) {
                            triggerLifecycleEvents(element);
                            finishInput('exec_command');
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
                        finishInput('exec_command');
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
                    const normalizedValue = normalizeForCompare(value);
                    const applied = normalizedValue.length > 0
                        && normalizeForCompare(element.textContent || '').includes(normalizedValue);
                    if (applied) {
                        strategy = 'beforeinput';
                    } else {
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
                strategy = 'value_setter';
                const valueSetter = resolveValueSetter();
                dispatchBeforeInput(value);
                if (valueSetter) {
                    valueSetter.call(element, value);
                } else {
                    element.value = value;
                }
            }

            triggerLifecycleEvents(element);
            finishInput(strategy);
        };
`
}
