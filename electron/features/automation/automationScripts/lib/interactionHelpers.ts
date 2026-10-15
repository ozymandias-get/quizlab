export const interactionHelpers = `    const queryElement = (lookup, kind, diagnostics, config) => {
        return queryElementWithPipeline(lookup, kind, diagnostics, config, 0);
    };

    const findElement = (lookup, kind, diagnostics, config) => {
        const start = now();
        const result = queryElement(lookup, kind, diagnostics, config);
        diagnostics.durationMs = roundMs(diagnostics.durationMs + (now() - start));
        return result;
    };

    const waitForElement = async (lookup, kind, diagnostics, config, timeout = 10000, mustBeInteractive = false, stableBlockedExitMs = 0) => {
        return resolveWithFallback(lookup, kind, diagnostics, config, timeout, mustBeInteractive, stableBlockedExitMs);
    };

    const triggerLifecycleEvents = (element) => {
        const options = { bubbles: true, cancelable: true, composed: true };
        const fire = (name) => {
            try {
                if (name === 'input') {
                    element.dispatchEvent(new InputEvent(name, Object.assign({}, options, {
                        inputType: 'insertText'
                    })));
                } else {
                    element.dispatchEvent(new Event(name, options));
                }
            } catch {}
        };
        // keydown/keypress/keyup atlanır: sentetik Event ile key:undefined gelir,
        // e.key/e.code okuyan siteleri yanıltır. blur/focusout da atlanır:
        // değer yazılır yazılmaz blur dispatch etmek SPA composer state'ini
        // commit/cancel edebilir. beforeinput burada tekrar gönderilmez;
        // setInputValue zaten gönderdi (tekrarı çift eklemeye yol açar).
        ['focus', 'focusin', 'input', 'change'].forEach(fire);

        const tracker = element._valueTracker;
        if (tracker) {
            try { tracker.setValue(element.value); } catch {}
        }
    };

    /**
     * Bir CSS sınıfı bir DURUM mudur, yoksa bir stil kuralı mı?
     *
     * Tailwind ve türevleri durumu bir "varyant" olarak adlandırır:
     *   \`disabled:opacity-50\`, \`aria-disabled:opacity-50\`,
     *   \`data-[state=open]:rotate\`, \`group-hover:bg-primary\`,
     *   \`[&:not(:disabled)]:underline\`
     * Bunlar butonun ŞU ANKİ halini değil, "disabled olduğunda ne olur"
     * kuralını tanımlar. \`includes('disabled')\` ile taranırsa ETKİN bir
     * gönder butonu "pasif" sayılır ve 15 saniyelik etkileşim kapısı
     * \`submit_not_ready\` ile düşer — metin alanda dururken mesaj hiç
     * gönderilmez. Varyant belirteçleri bu yüzden hiçbir zaman durum
     * sayılmaz.
     */
    const __isStyleVariantToken = (token) => {
        // \`group-hover:\`, \`aria-disabled:\`, \`peer-checked:\` …
        if (String(token).indexOf(':') !== -1) return true;
        // Tailwind arbitrary variant: \`[&:disabled]:*\`, \`[data-x="y"]\`
        if (String(token).charCodeAt(0) === 91 /* '[' */) return true;
        // CSS fonksiyonel pseudo sınıfı: \`:not(.disabled)\`, \`:is(.inactive)\`
        if (String(token).indexOf('(') !== -1) return true;
        return false;
    };

    /**
     * Utility (Tailwind benzeri) bir sınıfın "durum" sözcüğü içerdiği hâlde
     * yalnızca görsel olduğu durumlar. Bunlar durum sayılmaz.
     */
    const __UTILITY_PREFIXES = ['text-', 'bg-', 'border-', 'text_', 'bg_', 'border_', 'hover-', 'focus-', 'active-', 'ring-', 'shadow-'];

    const __isDisabledStateToken = (token) => {
        const normalized = String(token || '').toLowerCase();
        if (!normalized || __isStyleVariantToken(normalized)) return false;
        // Olumsuzlama: "not-disabled" / "no-disabled" bir durum DEĞİLDİR.
        if (normalized.indexOf('not-disabled') !== -1 || normalized.indexOf('not_disabled') !== -1) return false;
        if (normalized.indexOf('no-disabled') !== -1 || normalized.indexOf('no_disabled') !== -1) return false;
        if (normalized.indexOf('can-') === 0 || normalized.indexOf('is-enabled') === 0) return false;
        for (let i = 0; i < __UTILITY_PREFIXES.length; i++) {
            if (normalized.indexOf(__UTILITY_PREFIXES[i]) === 0) return false;
        }
        // Çıplak durum belirteçleri.
        if (normalized === 'disabled' || normalized === 'inactive') return true;
        // Bileşik durum belirteçleri: btn-disabled, send_btn_inactive,
        // is-disabled, mat-mdc-button-disabled, was_disabled …
        // Yalnızca SONDaki ek olarak: "text-disabled-gray" gibi ortadan geçen
        // utility adları yanlış pozitif üretmesin.
        return /[-_](disabled|inactive)$/.test(normalized);
    };

    /**
     * Bir düğmenin "pasif" olduğunu gösteren kalıcı (stable) göstergeler.
     * Bunlar zamanla kendiliğinden düzelmez; beklemek çözüm değildir. CSS
     * varyantı ve geçici UI salınımları bu kümede YER ALMAZ.
     */
    const __STABLE_BLOCKED_REASONS = [
        'disabled_property',
        'disabled_attribute',
        'aria_disabled',
        'data_disabled',
        'disabled_fieldset',
        'inert_ancestor'
    ];

    const isStableBlockedReason = (reason) =>
        typeof reason === 'string'
        && (__STABLE_BLOCKED_REASONS.indexOf(reason) !== -1 || reason.indexOf('disabled_class:') === 0);

    /**
     * Explains why \`isReadyForInteraction\` would reject an element.
     * Returns null when the element is ready. Kept in lockstep with
     * \`isReadyForInteraction\` so a \`submit_not_ready\` timeout can report the
     * actual blocker instead of only "still processing".
     *
     * Güvenilirlik sözleşmesi: yalnızca GERÇEK durum göstergeleri kullanılır —
     * \`disabled\` property/attribute, \`aria-disabled\`, \`data-disabled\`,
     * \`disabled\` fieldset, \`inert\` kapsayıcı ve çıplak durum sınıfları.
     * CSS varyant sınıfları (\`disabled:*\`) bilinçli olarak dışlanır.
     */
    const describeNotReady = (element) => {
        if (!element) {
            return 'element_missing';
        }

        const style = window.getComputedStyle(element);
        if (!element.offsetWidth || !element.offsetHeight) {
            return 'zero_size';
        }
        if (style.visibility === 'hidden') {
            return 'visibility_hidden';
        }
        if (style.display === 'none') {
            return 'display_none';
        }
        if (element.disabled === true) {
            return 'disabled_property';
        }
        if (element.getAttribute('disabled') !== null) {
            return 'disabled_attribute';
        }
        if (element.getAttribute('aria-disabled') === 'true') {
            return 'aria_disabled';
        }
        if (element.getAttribute('data-disabled') === 'true') {
            return 'data_disabled';
        }

        // HTML semantiği, sınıf adından bağımsız olarak düğmeyi geçersiz kılar:
        // \`disabled\` bir fieldset altındaki tüm denetimleri devre dışı bırakır.
        // Ebeveyn SINIF taraması yapılmaz: "inactive" gibi bir sınıf bir tab
        // panelinde tamamen meşru olabilir ve altındaki etkin gönder butonunu
        // yanlışlıkla pasif saymak, Hata A'nın aynı sınıf hatasını üst
        // seviyeye taşır. Yalnızca standart/semantik öznitelikler okunur.
        if (typeof element.closest === 'function') {
            if (element.closest('fieldset[disabled]')) {
                return 'disabled_fieldset';
            }
            if (element.closest('[inert]')) {
                return 'inert_ancestor';
            }
        }

        const disabledClass = Array.from(element.classList || []).find((className) =>
            __isDisabledStateToken(className)
        );
        if (disabledClass) {
            return 'disabled_class:' + String(disabledClass);
        }

        return null;
    };

    const isReadyForInteraction = (element) => describeNotReady(element) === null;

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

    /**
     * Editörün okunabilir içeriğini döndürür.
     *
     * Contenteditable alanlarda \`textContent\` blok ayırıcılarını (paragraf
     * sonları) kaybeder; \`innerText\` satır sonlarını korur. Doğrulama tarafında
     * iki varyant da okunduğu için burada tek bir "en iyi" okuma seçilir:
     * önce \`value\` (textarea/input), sonra dolu \`innerText\`, son \`textContent\`.
     */
    const readComposerText = (element) => {
        if (!element) return '';
        try {
            if (typeof element.value === 'string') return element.value;
            const contentEditable = element.isContentEditable
                || element.getAttribute('contenteditable') === 'true';
            if (contentEditable) {
                if (typeof element.innerText === 'string' && element.innerText.trim()) {
                    return element.innerText;
                }
                return element.textContent || '';
            }
            if (typeof element.innerText === 'string' && element.innerText.trim()) {
                return element.innerText;
            }
            return element.textContent || '';
        } catch (_) {
            return '';
        }
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
