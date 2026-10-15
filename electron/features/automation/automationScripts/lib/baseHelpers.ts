export const getBaseHelpers = (ambiguousSelectorBehavior: 'pick' | 'reject') => `\n
    const AMBIGUOUS_SELECTOR_BEHAVIOR = '${ambiguousSelectorBehavior}';
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now());
    const roundMs = (ms) => Math.round(ms * 100) / 100;
    const normalizeText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();

    // Karşılaştırma normalizasyonu: editörler (ProseMirror/Lexical) içeriği
    // kendi blok modeline göre okur — blok sınırındaki çift satır sonu tek
    // satır sonuna dönüşebilir, görünmez karakterler (zero-width) eklenebilir.
    // Ham includes() bu yüzden yanlış negatif üretir; karşılaştırmadan önce
    // iki taraf da bu fonksiyondan geçirilir.
    const normalizeForCompare = (value) => String(value || '')
        .replace(/[\\u200B-\\u200D\\uFEFF\\u2060]/g, '')
        .replace(/[\\s\\u00A0]+/g, ' ')
        .trim();

    // ── Run abort registry ─────────────────────────────────────────────────
    // SPA navigation / new-chat transitions must cancel pending waits and
    // MutationObservers immediately instead of letting them run until their
    // timeout. The renderer aborts via window.__quizlabAbortController.abort()
    // on did-navigate / did-navigate-in-page; every script run installs a
    // fresh controller so aborted state never leaks into the next run.
    const getAbortSignal = () => {
        try {
            if (typeof window === 'undefined') return null;
            if (!window.__quizlabAbortController || window.__quizlabAbortController.signal.aborted) {
                window.__quizlabAbortController = new AbortController();
            }
            return window.__quizlabAbortController.signal;
        } catch (_) {
            return null;
        }
    };

    const isAborted = () => {
        try {
            const controller = typeof window !== 'undefined' ? window.__quizlabAbortController : null;
            return Boolean(controller && controller.signal && controller.signal.aborted);
        } catch (_) {
            return false;
        }
    };

    const uniqueStrings = (values) => {
        const unique = [];
        for (const v of Array.isArray(values) ? values : []) {
            if (typeof v !== 'string') continue;
            const normalized = v.trim();
            if (!normalized || unique.includes(normalized)) continue;
            unique.push(normalized);
        }
        return unique;
    };

    const createSelectorDiagnostics = (selector, interactiveRequired = false) => ({
        requestedSelector: selector || null,
        matchedSelector: null,
        strategy: 'none',
        durationMs: 0,
        waitIterations: 0,
        cacheHits: 0,
        cacheInvalidations: 0,
        interactiveRequired
    });

    const createDiagnostics = (kind, options = {}) => ({
        kind,
        pageUrl: window.location.href,
        totalMs: 0,
        input: createSelectorDiagnostics(options.inputSelector || ''),
        button: options.includeButton ? createSelectorDiagnostics(options.buttonSelector || '', true) : undefined,
        setInputMs: 0,
        submitMs: 0,
        // Metnin alana hangi mekanizmayla girdiği (native_paste /
        // synthetic_paste / exec_command / beforeinput / dom_insert /
        // value_setter / human_typing). Ölçüm alanı: içerik veya kullanıcı
        // verisi taşımaz, yalnızca strateji adıdır.
        textInputStrategy: null,
        // Yapıştırma doğrulanamadığı için yazım fallback'i kullanıldıysa dolu.
        textInputFallback: null,
        // Submit öncesi sabit settle beklemesinin gerçekten uygulanan süresi.
        preSubmitWaitMs: 0,
        error: null
    });

    const finalizeDiagnostics = (diagnostics, startedAt, error = null) => {
        diagnostics.totalMs = roundMs(now() - startedAt);
        diagnostics.error = error;
        return diagnostics;
    };
\n`
