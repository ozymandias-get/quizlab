/**
 * Site Strategy Runtime — injected guest-page block.
 * `siteStrategyRegistry.ts` birbirine karışan iki sorumluluğu taşıyordu: host
 * tarafındaki registry API'si (kayıt/eşleştirme/built-in stratejiler) ve
 * uzak sayfaya enjekte edilen saf string bloğu (`siteStrategyRuntime`). İkisi
 * arasındaki tek bağ, aşağıdaki `${...}` interpolasyonlarıdır; bu dosya o
 * bağımlılığı tek yönlü tutar: registry'den DEĞER okur, registry'ye yazmaz.
 *
 * Taşınan içerik bayt bayt aynıdır: interpolasyonlar aynı kaynak
 * sabitlerine bağlandığı için üretilen script metni değişmez.
 */
import {
  SELECTOR_BUTTON_RULES,
  SELECTOR_INPUT_RULES,
  VOICE_CONTROL_LABEL_PATTERN
} from './siteStrategyRegistry.js'

/**
 * Uzak sayfa runtime'ında strateji çağrısı. Bu fonksiyon string template'e
 * dönüştürülürken yalnızca iskelet kalır.
 *
 * Template, TS tarafındaki genel kurallarla aynı composer/diktasyon yardımcılarını
 * da taşır: bu blok runtime'da ikinci sırada enjekte edilir, bu yüzden hem
 * sonradan gelen site stratejileri hem de fallbackPipeline aynı "dikte düğmesi
 * gönder düğmesi değildir / gönder düğmesi composer'ın içindedir" kuralını
 * kullanabilir. Yardımcılar burada tanımlı olduğu için fallbackPipeline
 * (aşağıda) onları yeniden tanımlamaz.
 */
export const siteStrategyRuntime = `    const __DICTATION_ATTRIBUTES = ['data-start-dictation', 'data-cancel-dictation', 'data-submit-dictation'];
    const __COMPOSER_INPUT_SELECTOR = 'textarea, div[contenteditable="true"], .ProseMirror, [role="textbox"]';
    const __COMPOSER_CONTAINER_SELECTORS = [
        '[data-composer-body]',
        '[data-composer-input]',
        '[data-composer-layout]',
        '[data-composer-footer]',
        '[data-testid*="composer" i]',
        '[data-testid*="prompt" i]',
        '[class*="composer" i]',
        'form',
        '[role="form"]'
    ];
    const __VOICE_CONTROL_LABEL_PATTERN = ${VOICE_CONTROL_LABEL_PATTERN.toString()};

    /**
     * Görünür ve etkileşime hazır mı? Gizli (display:none / visibility:hidden)
     * bir gönder düğmesi "bulundu" sayılmaz; aksi halde tıklama sessizce
     * yutulur ve mesaj hiç gitmez.
     */
    const __isVisibleCandidate = (el, minWidth, minHeight) => {
        if (!el || !el.isConnected) return false;
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return false; }
        if (rect.width < minWidth || rect.height < minHeight) return false;
        try {
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
        } catch (e) {
            // computed style alınamıyorsa boyut kontrolü yeterli
        }
        return true;
    };

    /**
     * Ses/dikte düğmesi mi? Etiket dile bağlı olduğu için (ölçülen TR örnekleri:
     * "Dikte et", "Sesli iletişimi başlat"; EN: "Dictate", "Start voice
     * conversation") data öznitelikleri tek başına yetmiyor: canlı
     * chatgpt.com'da bu düğmenin data özniteliği YOK, yalnız aria-label'ı var.
     * Bu bir güvenli RED kuralıdır — yanlış red bir tur bekletir, yanlış kabul
     * mesajı dikteye gönderir.
     */
    const __isDictationControl = (el) => {
        if (!el || typeof el.hasAttribute !== 'function') return false;
        for (let i = 0; i < __DICTATION_ATTRIBUTES.length; i++) {
            if (el.hasAttribute(__DICTATION_ATTRIBUTES[i])) return true;
        }
        try {
            const label = ((el.getAttribute && el.getAttribute('aria-label')) || '')
                + ' ' + ((el.getAttribute && el.getAttribute('title')) || '');
            if (label.trim() && __VOICE_CONTROL_LABEL_PATTERN.test(label)) return true;
        } catch (e) {
            // getAttribute yoksa yalnızca öznitelik listesi geçerli olur
        }
        return false;
    };

    /**
     * Kabuk, gönder düğmesi aramaya değer mi? Tıklanabilir bir kontrol içermeli.
     * Sınıf alt dizesi eşleşmesi butonsuz bir sarmalayıcıda durabildiği için
     * (ölçülen ChatGPT durumu: 540x36, 0 buton) bu kontrol yanlış kabuğu
     * reddetmenin genel yoludur.
     */
    const __containsClickableControl = (root) => {
        if (!root || typeof root.querySelector !== 'function') return false;
        try {
            return root.querySelector('button, [role="button"], input[type="submit"], input[type="button"]') !== null;
        } catch (e) {
            return false;
        }
    };

    /**
     * Composer girdisinin bulunduğu kabuk. 2026-10-17 canlı chatgpt.com ölçümü:
     * eski tek satırlık kural butonsuz bir sarmalayıcıya çözülüyordu, bu yüzden
     * data-composer-* kancaları öne alındı ve buton aramasında kapsam doğrulaması
     * eklendi. requireControls yalnız gönder DÜĞMESİ aranırken doğrudur.
     */
    const __findComposerContainer = (requireControls) => {
        let input = null;
        try {
            input = document.querySelector(__COMPOSER_INPUT_SELECTOR);
        } catch (e) {
            input = null;
        }
        if (input && input.closest) {
            for (let i = 0; i < __COMPOSER_CONTAINER_SELECTORS.length; i++) {
                let container = null;
                try {
                    container = input.closest(__COMPOSER_CONTAINER_SELECTORS[i]);
                } catch (e) {
                    container = null;
                }
                if (!container) continue;
                if (requireControls && !__containsClickableControl(container)) continue;
                return container;
            }
        }
        for (let i = 0; i < __COMPOSER_CONTAINER_SELECTORS.length; i++) {
            let container = null;
            try {
                container = document.querySelector(__COMPOSER_CONTAINER_SELECTORS[i]);
            } catch (e) {
                container = null;
            }
            if (!container) continue;
            if (requireControls && !__containsClickableControl(container)) continue;
            return container;
        }
        return null;
    };

    /**
     * Composer içindeki gerçek gönder düğmesi. Ölçüm: composer'da gönder
     * düğmesi type="submit" olan tek öğe ve dikte düğmesi (type="button") ile
     * aynı anda duruyor. Kapsam doğru çözüldüğünde bu arama KARAR verir;
     * sayfa geneline hiç bakılmaz.
     */
    const __findComposerSubmit = (composer) => {
        if (!composer) return null;
        let matches;
        try {
            matches = composer.querySelectorAll('button[type="submit"], input[type="submit"]');
        } catch (e) {
            return null;
        }
        for (let i = 0; i < matches.length; i++) {
            const el = matches[i];
            if (__isDictationControl(el)) continue;
            if (!__isVisibleCandidate(el, 8, 8)) continue;
            return el;
        }
        return null;
    };

    /**
     * Composer kabuğunun kendisi mi, içindeki bir öğe mi? Ölçümde
     * data-composer-submit YOK; kararlı kanca type="submit". İkisi de kabul
     * edilir (ölü kanca ileride geri gelirse).
     */
    const __isComposerSubmitControl = (el, container) => {
        if (!el || typeof el.hasAttribute !== 'function') return false;
        const isSubmitHook = el.hasAttribute('data-composer-submit')
            || el.getAttribute('type') === 'submit';
        if (!isSubmitHook) return false;
        if (!container) return false;
        if (container === el) return true;
        try {
            return Boolean(container.contains && container.contains(el));
        } catch (e) {
            return false;
        }
    };

    const __SELECTOR_INPUT_RULES = ${JSON.stringify(SELECTOR_INPUT_RULES)};
    const __SELECTOR_BUTTON_RULES = ${JSON.stringify(SELECTOR_BUTTON_RULES)};

    const __findVisibleBySelector = (root, selector, minWidth, minHeight) => {
        if (!root || typeof root.querySelectorAll !== 'function') return null;
        let matches;
        try {
            matches = root.querySelectorAll(selector);
        } catch (e) {
            return null;
        }
        for (let i = 0; i < matches.length; i++) {
            if (__isVisibleCandidate(matches[i], minWidth, minHeight)) return matches[i];
        }
        return null;
    };

    const __tryGenericInputFallback = () => {
        for (let i = 0; i < __SELECTOR_INPUT_RULES.length; i++) {
            const rule = __SELECTOR_INPUT_RULES[i];
            const el = __findVisibleBySelector(document, rule.selector, rule.minWidth, rule.minHeight);
            if (el) {
                return {
                    element: el,
                    matchedSelector: 'generic:input:' + rule.selector,
                    strategy: 'provider'
                };
            }
        }
        return null;
    };

    const __findButtonInRoot = (root) => {
        if (!root || typeof root.querySelectorAll !== 'function') return null;
        for (let i = 0; i < __SELECTOR_BUTTON_RULES.length; i++) {
            const selector = __SELECTOR_BUTTON_RULES[i];
            let matches;
            try {
                matches = root.querySelectorAll(selector);
            } catch (e) {
                continue;
            }
            for (let j = 0; j < matches.length; j++) {
                const el = matches[j];
                if (__isDictationControl(el)) continue;
                if (__isVisibleCandidate(el, 8, 8)) return { element: el, selector: selector };
            }
        }
        return null;
    };

    const __tryGenericButtonFallback = () => {
        const composer = __findComposerContainer(true);
        if (composer) {
            const decisive = __findComposerSubmit(composer);
            if (decisive) {
                return {
                    element: decisive,
                    matchedSelector: 'generic:button:composer:submit',
                    strategy: 'provider'
                };
            }
        }
        const roots = composer ? [composer, document] : [document];
        for (let i = 0; i < roots.length; i++) {
            const found = __findButtonInRoot(roots[i]);
            if (found) {
                return {
                    element: found.element,
                    matchedSelector: 'generic:button:' + found.selector,
                    strategy: 'provider'
                };
            }
        }
        return null;
    };

    const __tryGenericByKind = (kind) => {
        return kind === 'input' ? __tryGenericInputFallback() : __tryGenericButtonFallback();
    };

    const __SITE_STRATEGIES = [];
    const __registerSiteStrategy = (strategy) => {
        if (!strategy || typeof strategy.id !== 'string') return;
        const existingIdx = __SITE_STRATEGIES.findIndex((s) => s.id === strategy.id);
        if (existingIdx >= 0) {
            __SITE_STRATEGIES[existingIdx] = strategy;
        } else {
            __SITE_STRATEGIES.push(strategy);
        }
    };
    let __builtinsRegistered = false;
    const __ensureBuiltinSiteStrategiesRegistered = () => {
        if (__builtinsRegistered) return;
        __builtinsRegistered = true;
        const specs = [
            ['builtin:claude', ['claude.ai']],
            ['builtin:deepseek', ['deepseek.com']],
            ['builtin:qwen', ['qwen']],
            ['builtin:kimi', ['kimi']],
            ['builtin:chatgpt', ['chatgpt.com']],
            ['builtin:gemini', ['gemini.google.com']],
            ['builtin:aistudio', ['aistudio.google.com']],
            ['builtin:m365', ['copilot.microsoft.com']],
            ['builtin:youtube', ['youtube.com']],
            ['builtin:api-chat', ['api-chat']]
        ];
        for (let i = 0; i < specs.length; i++) {
            __registerSiteStrategy({
                id: specs[i][0],
                match: { hostPatterns: specs[i][1] },
                produce: __tryGenericByKind
            });
        }
        __registerSiteStrategy({
            id: 'builtin:generic',
            match: { hostPatterns: [''], priority: -100 },
            produce: __tryGenericByKind
        });
    };
    const __listApplicableStrategies = (hostname) => {
        const lower = String(hostname || '').toLowerCase();
        const matches = [];
        for (let i = 0; i < __SITE_STRATEGIES.length; i++) {
            const strategy = __SITE_STRATEGIES[i];
            const patterns = (strategy.match && strategy.match.hostPatterns) || [];
            let allMatch = true;
            for (let j = 0; j < patterns.length; j++) {
                if (lower.indexOf(String(patterns[j]).toLowerCase()) < 0) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) matches.push(strategy);
        }
        matches.sort(function (a, b) {
            return ((b.match && b.match.priority) || 0) - ((a.match && a.match.priority) || 0);
        });
        return matches;
    };
    const __runSiteStrategy = (hostname, kind) => {
        const matches = __listApplicableStrategies(hostname);
        for (let i = 0; i < matches.length; i++) {
            try {
                const result = matches[i].produce(kind);
                if (result && result.element) {
                    return Object.assign({ strategyId: matches[i].id }, result);
                }
            } catch (e) {
                // strateji patlarsa sessizce sonrakine geç
            }
        }
        return null;
    };
`
