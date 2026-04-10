export const getBaseHelpers = (ambiguousSelectorBehavior: 'pick' | 'reject') => `\n
    const AMBIGUOUS_SELECTOR_BEHAVIOR = '${ambiguousSelectorBehavior}';
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now());
    const roundMs = (value) => Math.round(value * 100) / 100;
    const normalizeText = (value) => String(value || '').replace(/\\\\s+/g, ' ').trim();

    const uniqueStrings = (values) => {
        const unique = [];
        for (const value of Array.isArray(values) ? values : []) {
            if (typeof value !== 'string') continue;
            const normalized = value.trim();
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
        error: null
    });

    const finalizeDiagnostics = (diagnostics, startedAt, error = null) => {
        diagnostics.totalMs = roundMs(now() - startedAt);
        diagnostics.error = error;
        return diagnostics;
    };
\n`
