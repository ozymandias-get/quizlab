export const cachingHelpers = `    const getAutomationCache = () => {
        const cacheKey = '__quizlabReaderAutomationCache';
        const globalCache = window[cacheKey] || {};

        if (!globalCache.elements || typeof globalCache.elements !== 'object') {
            globalCache.elements = {};
        }

        if (globalCache.pageUrl !== window.location.href) {
            globalCache.pageUrl = window.location.href;
            globalCache.elements = {};
        }

        window[cacheKey] = globalCache;
        return globalCache;
    };

    const getLookupCacheKey = (lookup) => JSON.stringify({
        selectors: uniqueStrings(lookup && lookup.selectors),
        fingerprint: lookup && lookup.fingerprint ? lookup.fingerprint : null
    });

    const getCacheEntry = (kind, lookup) => {
        const cache = getAutomationCache();
        const key = kind + '::' + getLookupCacheKey(lookup);

        if (!cache.elements[key]) {
            cache.elements[key] = {
                element: null,
                matchedSelector: null
            };
        }

        return cache.elements[key];
    };

    const invalidateCacheEntry = (kind, lookup, diagnostics) => {
        const entry = getCacheEntry(kind, lookup);
        if (!entry.element && !entry.matchedSelector) {
            return;
        }

        entry.element = null;
        entry.matchedSelector = null;
        if (diagnostics) {
            diagnostics.cacheInvalidations += 1;
        }
    };

    const getCachedElement = (kind, lookup, diagnostics) => {
        const entry = getCacheEntry(kind, lookup);
        const element = entry.element;

        if (element && element.isConnected !== false) {
            diagnostics.cacheHits += 1;
            diagnostics.strategy = 'cache';
            diagnostics.matchedSelector = entry.matchedSelector || diagnostics.requestedSelector || null;
            return {
                element,
                matchedSelector: diagnostics.matchedSelector,
                strategy: 'cache'
            };
        }

        if (entry.element || entry.matchedSelector) {
            invalidateCacheEntry(kind, lookup, diagnostics);
        }

        return null;
    };

    const cacheElement = (kind, lookup, matchedSelector, element) => {
        const entry = getCacheEntry(kind, lookup);
        entry.element = element || null;
        entry.matchedSelector = matchedSelector || null;
    };
\n`
