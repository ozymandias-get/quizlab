/**
 * Webview runtime için hata sınıflandırıcı.
 *
 * `errorClassifier.ts` (TypeScript) tek kaynaktır; bu dosya onu webview'e
 * enjekte edilecek string template'e dönüştürür. Sadece minimal yardımcıları
 * içerir — her yere şişman bir tablo enjekte etmek yerine, generated script
 * yalnızca "ne yapacağını" bilir.
 *
 * Selector veya submit gibi hata kategorilerinin kendileri script tarafında
 * zaten bilinir; buradaki tek sorumluluk **fallback tetikleyip tetiklememe**
 * ve **kullanıcı dostu kod dönüşü**dür. Bu sayede ana script sınıflandırma
 * bilgisi taşımak zorunda kalmaz.
 */

export const errorClassifierRuntime = `    /**
     * Hata kodunu normalize eder (gürültüyü eler).
     * Illegal invocation gibi framework hataları "unknown" olur.
     */
    const __normalizeErrorCode = (raw) => {
        if (typeof raw !== 'string') return 'unknown';
        const trimmed = String(raw).trim();
        if (!trimmed || trimmed === 'Illegal invocation') return 'unknown';
        return trimmed;
    };

    /**
     * Hata kodu → strateji dönüşümü.
     * Dizi olduğu için O(1) sıralı arama yeterlidir.
     *
     * Kategori kodu, kategori adı ve fallback önerisi tek bir tuple'da tutulur.
     * Yeni kod ekleneceği zaman en başa eklemek yeterlidir.
     */
    const __ERROR_TABLE = Object.freeze([
        // [regex, retry, triggerFallback, category, toastKey]
        [/^selector_repick_required$/, 'never', false, 'selector', 'toast_selectors_need_repick'],
        [/^input_not_found$/, 'after-repick', false, 'selector', 'toast_input_not_found'],
        [/^button_not_found$/, 'after-repick', false, 'selector', 'toast_button_not_found'],
        [/^ambiguous_match$/, 'after-repick', false, 'selector', 'toast_selectors_ambiguous'],
        [/^submit_not_ready$/, 'different-strategy', true, 'submit', 'toast_submit_not_ready'],
        [/^submit_failed$/, 'same-strategy', true, 'submit', 'toast_submit_failed'],
        [/^click_failed$/, 'same-strategy', false, 'submit', 'toast_click_failed'],
        [/^paste_failed$/, 'different-strategy', true, 'paste', 'toast_paste_failed'],
        [/^clipboard_failed$/, 'after-backoff', true, 'clipboard', 'toast_clipboard_failed'],
        [/^upload_failed$/, 'different-strategy', true, 'upload', 'toast_upload_failed'],
        [/^upload_timed_out$/, 'after-backoff', true, 'upload', 'toast_upload_timed_out'],
        [/^network_error$/, 'after-backoff', true, 'network', 'toast_network_error'],
        [/^timed_out$/, 'same-strategy', true, 'timeout', 'toast_automation_timed_out'],
        [/(timeout|timed_out)/i, 'same-strategy', true, 'timeout', 'toast_automation_timed_out'],
        [/^webview_destroyed$/, 'never', false, 'webview', 'toast_webview_destroyed'],
        [/^webview_not_ready$/, 'never', false, 'webview', 'toast_webview_not_ready'],
        [/^wrong_url$/, 'never', false, 'site', 'toast_wrong_url'],
        [/^auth_required$/, 'never', false, 'permission', 'toast_auth_required'],
        [/^config_not_found$/, 'never', false, 'config', 'toast_config_not_found'],
        [/^empty_text$/, 'never', false, 'config', 'toast_empty_text'],
        [/^invalid_image_format$/, 'never', false, 'config', 'toast_invalid_image_format'],
        [/^cancelled$/, 'never', false, 'unknown', 'toast_automation_cancelled']
    ]);

    const __FALLBACK_RETRY = Object.freeze({
        never: 0,
        'after-repick': 0,
        'same-strategy': 1,
        'different-strategy': 1,
        'after-backoff': 2
    });

    /**
     * Hata kodunu sınıflandırır.
     * @returns {{code, retry, triggerFallback, category, toastKey}}
     */
    const __classifyError = (raw) => {
        const code = __normalizeErrorCode(raw);
        for (let i = 0; i < __ERROR_TABLE.length; i++) {
            const entry = __ERROR_TABLE[i];
            if (entry[0].test(code)) {
                return {
                    code: code,
                    retry: entry[1],
                    triggerFallback: entry[2],
                    category: entry[3],
                    toastKey: entry[4]
                };
            }
        }
        return {
            code: code,
            retry: 'same-strategy',
            triggerFallback: true,
            category: 'unknown',
            toastKey: 'toast_automation_failed'
        };
    };

    /**
     * Bir hatanın kaç kez daha denenmesi gerektiğini söyler.
     * Yeniden deneme politikası ("same-strategy" / "different-strategy" / "after-backoff")
     * tarafından yönlendirilir. Selector yeniden seçim gerektiğinde 0 döner.
     */
    const __retryBudgetFor = (raw) => {
        const cls = __classifyError(raw);
        return __FALLBACK_RETRY[cls.retry] || 0;
    };
`
