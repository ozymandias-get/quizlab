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
            // corrupting characters. Above this threshold we first try a
            // synthetic paste event (the editor's native bulk-insert path),
            // which is designed to ingest large payloads in one pass.
            const LARGE_TEXT_THRESHOLD = 2000;
            // Chunk size for the spread-out execCommand fallback. Long enough
            // to keep the per-call overhead negligible, short enough that a
            // single synchronous DOM/AST rebuild cannot trip the watchdog.
            const LARGE_TEXT_CHUNK = 800;

            /**
             * "Metin DOM'da görünüyor" ile "editörün modeli metni aldı" AYNI
             * şey değildir. ProseMirror/Lexical/Quill kendi AST'sini tutar;
             * ham bir metin düğümü \`appendChild\` ile eklendiğinde ekranda
             * görünür ama gönder butonu pasif kalır — Hata C'nin tam olarak
             * tarif ettiği "metin ekranda var ama gönderilmiyor" durumu.
             *
             * Bu yüzden ham ekleme artık başarı sayılmaz; strateji adı
             * \`dom_insert_unverified\` olarak raporlanır ve çağıran taraf
             * bunu doğrulama katmanına bırakır.
             */
            const INSERT_UNVERIFIED = 'dom_insert_unverified';

            /**
             * Beklenen metnin alana girdiğini doğrular.
             *
             * ÖNEMLİ: \`textContent\` ve \`innerText\` birleştirilip tek bir
             * dizge üzerinde \`includes\` aranmaz — iki okuma birbirinin
             * devamı gibi görünebilir ve yanlış pozitif doğar. Her varyant
             * KENDİ başına denenir.
             */
            const payloadHasLanded = (target, payload) => {
                const normalizedPayload = normalizeForCompare(payload);
                if (!normalizedPayload) return false;
                const variants = [
                    target.textContent || '',
                    (function () { try { return target.innerText || ''; } catch (_) { return ''; } })()
                ];
                for (let i = 0; i < variants.length; i++) {
                    if (normalizeForCompare(variants[i]).indexOf(normalizedPayload) !== -1) return true;
                }
                return false;
            };

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
                // Sentetik yapıştırma bir EN İYİ DENEMEDİR, zorunlu adım
                // değildir: \`ClipboardEvent\` ya da \`DataTransfer\` bulunmayan
                // bir motorda (bazı jsdom sürümleri, kısıtlı gömülü webview'lar)
                // istisna fırlatmak tüm gönderimi çökertmemeli — çağıran taraf
                // sıradaki gerçek düzenleme kanalına düşer.
                try {
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
                } catch (_) {
                    return false;
                }
            };

            /**
             * \`execCommand('insertText')\` gerçek düzenleme kanalıdır:
             * tarayıcı \`beforeinput\`/\`input\` olaylarını üretir ve
             * ProseMirror/Lexical bunları GÖZLEMEYİ modele yazar. Uzun
             * payload'da tek senkron çağrı ana iş parçacığını kilitlediği
             * için parçalara bölünür; her parça arasında bir görev daha
             * verilir (await wait(0)).
             */
            const insertViaExecCommand = async (target, text, chunked) => {
                if (typeof document.execCommand !== 'function') return false;
                if (!chunked) {
                    try {
                        return Boolean(document.execCommand('insertText', false, text));
                    } catch (_) {
                        return false;
                    }
                }
                const chars = Array.from(text);
                for (let offset = 0; offset < chars.length; offset += LARGE_TEXT_CHUNK) {
                    if (typeof isAborted === 'function' && isAborted()) return false;
                    const chunk = chars.slice(offset, offset + LARGE_TEXT_CHUNK).join('');
                    let ok = false;
                    try {
                        ok = Boolean(document.execCommand('insertText', false, chunk));
                    } catch (_) {
                        return false;
                    }
                    if (!ok) return false;
                    await wait(0);
                }
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
                // eklenebilir); iki taraf da normalize edilerek TAM içerik
                // karşılaştırılır. Eski baş-40 örnek karşılaştırması yalnızca
                // ilk parçanın girmesini "başarılı yapıştırma" sayıyordu.
                if (payloadHasLanded(target, payload)) return 'synthetic_paste';
                // Sentetik paste reddedildi (editör \`isTrusted=false\` olayı
                // yok sayıyor ya da kendi \`handlePaste\` implementasyonu metni
                // almıyor). Sıradaki gerçek düzenleme kanalı \`execCommand\`:
                // tarayıcı olayları kendi üretir, framework modeli güncellenir.
                if (await insertViaExecCommand(target, payload, true)) {
                    await wait(0);
                    if (payloadHasLanded(target, payload)) return 'exec_command_chunked';
                }

                // Son çare: sentetik \`beforeinput\`. Yalnızca OLUŞTURMAK
                // içerik eklemez — tarayıcı \`beforeinput\`'ı kendi DOM
                // mutasyonunu yapmadan gönderir. Etkisi ölçülür.
                dispatchBeforeInput(payload);
                await wait(0);
                if (payloadHasLanded(target, payload)) return 'beforeinput';

                try {
                    const node = document.createTextNode(payload);
                    target.appendChild(node);
                    // Ham DOM eklemesi bir "başarı" DEĞİLDİR: strateji
                    // açıkça doğrulanmamış olarak raporlanır. Metin ekranda
                    // görünebilir ama framework modelinde olmayabilir ve
                    // gönder butonu pasif kalabilir.
                    return INSERT_UNVERIFIED;
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
                let strategy = INSERT_UNVERIFIED;
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
                    if (payloadHasLanded(element, payload)) {
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

            let strategy = INSERT_UNVERIFIED;
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
                    if (payloadHasLanded(element, value)) {
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
