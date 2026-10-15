interface BuildPerformSubmitScriptOptions {
  includeInputLookupForEnter: boolean
}

/**
 * Gönder butonunun "kararlı biçimde pasif" kalması ne kadar sürebilir?
 *
 * Metin doğrulandıktan sonra gönder butonu hâlâ `disabled` ise sorun bekleme
 * değildir: editörün iç modeli metni almamıştır (DOM'a elle eklenmiş olabilir).
 * 15 saniyeyi doldurmak yalnızca kullanıcıyı bekletir ve sonucu değiştirmez,
 * bu yüzden bekleme 2 saniyede sonlanır ve gerçek neden raporlanır.
 */
const STABLE_BLOCKED_EXIT_MS = 2000

/**
 * Builds the shared submit routine used by the auto-send and click-send scripts.
 *
 * Besides submitting, this is the single place that decides whether a *button*
 * or *input* recovery counts as a real, successful usage. The rule is
 * deliberately branch-local: a `click` submit only credits the button, an
 * `enter_key` submit only credits the input, so an untouched locator can never
 * be promoted on the strength of the other one's success.
 *
 * Gönderim durumu (task §8) üç ayrı kavram olarak modellenir ve birbirine
 * karıştırılmaz:
 *   - `submit_attempted`   → gönderim gerçekten tetiklendi (click/Enter)
 *   - `submit_observed`    → arayüzde beklenen etki GÖZLEMLENDİ
 *   - `delivery_unconfirmed` → gönderim denendi ama etki doğrulanamadı
 *
 * Sentetik `KeyboardEvent` için `dispatchEvent()` dönüşü BAŞARI sayılmaz:
 * birçok web uygulaması `isTrusted === false` olayları yok sayar ve mesaj
 * hiç gönderilmez. Bu yüzden Enter yolu gönderimden sonra editörü ve konuşma
 * bölgesini GÖZLEMLER; etki yoksa `submit_unverified` döner ve üst katman
 * bunu "teslim edilmedi" olarak işaretler (mükerrer gönderim de engellenir).
 */
export function buildPerformSubmitScript(options: BuildPerformSubmitScriptOptions): string {
  const enterDispatch = (target: string) => `
                {
                    const eventParams = {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    };
                    ${target}.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                    ${target}.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                    ${target}.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                }
`

  const inputLookup = options.includeInputLookupForEnter
    ? `
                const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
                const inputElement = inputResult.element;

                if (inputElement) {
                    inputElement.focus();
                    const beforeEnter = __submitFingerprint(inputElement, null);
                    diagnostics.submitMethod = 'enter_key';
${enterDispatch('inputElement')}                    const enterObserved = await __observeSubmitEffect(inputElement, null, beforeEnter);
                    diagnostics.submitObserved = enterObserved;
                    success = enterObserved;
                    if (!enterObserved) {
                        // Mesaj editörden AYRILMADI: gönderim gerçekleşmedi.
                        // Editör hâlâ dolu olduğu için taslak kaybolmaz.
                        error = 'submit_unverified';
                        diagnostics.submitOutcome = 'delivery_unconfirmed';
                    } else {
                        // Editörün temizlenmesi tek başına sunucu teslim kanıtı
                        // değildir; yalnızca arayüz etkisi gözlemlendi.
                        diagnostics.submitOutcome = 'observed';
                    }
                    __finalizeSelectorRepair(diagnostics.input, 'input', success);
                } else {
                    error = resolveLookupError(config.input, 'input_not_found', config.health);
                    diagnostics.submitOutcome = 'not_attempted';
                    __finalizeSelectorRepair(diagnostics.input, 'input', false);
                }
`
    : `
                inputElement.focus();
                const beforeEnter = __submitFingerprint(inputElement, null);
                diagnostics.submitMethod = 'enter_key';
${enterDispatch('inputElement')}                const enterObserved = await __observeSubmitEffect(inputElement, null, beforeEnter);
                diagnostics.submitObserved = enterObserved;
                success = enterObserved;
                if (!enterObserved) {
                    error = 'submit_unverified';
                    diagnostics.submitOutcome = 'delivery_unconfirmed';
                } else {
                    diagnostics.submitOutcome = 'observed';
                }
                __finalizeSelectorRepair(diagnostics.input, 'input', success);
`

  return `
        // ── Gönderim gözlemi ────────────────────────────────────────────────
        // Sentetik klavye/click olaylarının "gerçekten bir işe yaradığı" yalnızca
        // sayfa durumu izlenerek anlaşılır. Bu yardımcılar yalnızca GÖZLEM yapar:
        // ikinci bir Enter veya ikinci bir click asla gönderilmez.
        const __submitFingerprint = (inputElement, buttonElement) => {
            const text = normalizeForCompare(readComposerText(inputElement));
            const root = getComposerRoot(inputElement, buttonElement);
            let conversationNodes = -1;
            let streaming = false;
            try {
                conversationNodes = root.querySelectorAll(
                    'article, [data-message-author-role], [data-message-id], [data-testid*="conversation-turn" i], [data-testid*="user-message" i], [class*="message" i], [class*="markdown" i]'
                ).length;
                streaming = Boolean(root.querySelector(
                    'button[aria-label*="Stop" i], button[data-testid*="stop" i], button[aria-label*="Durdur" i], [data-testid*="stop-button" i]'
                ));
            } catch (_) {}
            return text.length + '|' + text.slice(0, 80) + '|' + conversationNodes + '|' + (streaming ? '1' : '0');
        };

        const __observeSubmitEffect = async (inputElement, buttonElement, before, attempts = 10, intervalMs = 80) => {
            for (let i = 0; i < attempts; i++) {
                if (typeof isAborted === 'function' && isAborted()) return false;
                await wait(intervalMs);
                let after = null;
                try {
                    after = __submitFingerprint(inputElement, buttonElement);
                } catch (_) {
                    after = null;
                }
                // Beklenen etki: mesaj editörden ayrıldı (metin temizlendi /
                // kısaldı) ya da konuşmaya yeni bir düğüm eklendi / durum
                // "yanıt üretiliyor"a geçti.
                if (after && before && after !== before) return true;
            }
            return false;
        };

        const performSubmit = async (${options.includeInputLookupForEnter ? '' : 'inputElement'}) => {
            const start = now();
            const mode = config.submitMode;
            let success = false;
            let error = null;
            let notReadyReason = null;

            // click_send betiği performSubmit'i parametresiz çağırır: bu
            // kapsamda \`inputElement\` bağlı değildir. Gözlem için gerekiyorsa
            // bloklamayan bir aramayla çözülür (yoksa gözlem yalnızca buton
            // tarafına düşer, gönderim yine de yapılır).
            const __resolveSubmitInput = () => {
                if (typeof inputElement !== 'undefined' && inputElement) return inputElement;
                if (!hasLookup(config.input) || !diagnostics.input) return null;
                try {
                    return findElement(config.input, 'input', diagnostics.input, config).element;
                } catch (_) {
                    return null;
                }
            };

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(
                    config.button,
                    'button',
                    diagnostics.button,
                    config,
                    15000,
                    true,
                    ${STABLE_BLOCKED_EXIT_MS}
                );
                const button = buttonResult.element;

                if (button) {
                    const submitInput = __resolveSubmitInput();
                    const beforeClick = __submitFingerprint(submitInput, button);
                    button.click();
                    diagnostics.submitMethod = 'button_click';
                    // Click üzerinde de gözlem yapılır ama SERT BAŞARISIZLIK
                    // üretilmez: etkin bir gönder butonuna tıklamak gerçek bir
                    // gönderim girişimidir. Teslimat kanıtı olmadığı açıkça
                    // işaretlenir (\`delivery_unconfirmed\`) ki üst katman
                    // kullanıcıya "gönderildi" ile "teslim doğrulanmadı" ayrımını
                    // yapabilsin.
                    diagnostics.submitObserved = await __observeSubmitEffect(submitInput, button, beforeClick);
                    diagnostics.submitOutcome = diagnostics.submitObserved ? 'observed' : 'delivery_unconfirmed';
                    success = true;
                    // A completed click is the send button's only "real usage".
                    __finalizeSelectorRepair(diagnostics.button, 'button', true);
                } else {
                    notReadyReason = buttonResult.notReadyReason || null;
                    const blocked = buttonResult.blockedElement || null;
                    if (blocked) {
                        // Buton BULUNDU ama etkileşime hazır değil. Bu bir
                        // selector hatası DEĞİLDİR: \`button_not_found\` bildirmek
                        // kullanıcıyı yanlışlıkla selector'ını yeniden seçmeye
                        // yönlendirirdi. Gerçek engel raporlanır.
                        error = 'submit_not_ready';
                        diagnostics.submitOutcome = 'blocked';
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    } else if (mode === 'click') {
                        error = resolveLookupError(config.button, 'button_not_found', config.health);
                        diagnostics.submitOutcome = 'not_attempted';
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    } else {
                        // \`mixed\`: gerçek bir gönder butonu sayfada yok. Enter
                        // yoluna düşmek güvenlidir (aşağıda doğrulanır).
                        diagnostics.submitOutcome = 'not_attempted';
                    }
                }
            }

            if (!success && !error && (mode === 'enter_key' || mode === 'mixed')) {
${inputLookup}
            }

            diagnostics.submitMs = roundMs(now() - start);
            return {
                success,
                error,
                notReadyReason
            };
        };
    `
}
