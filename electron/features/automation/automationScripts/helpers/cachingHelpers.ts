export const cachingHelpers = `    const CACHE_TTL_MS = 86400000;
    const CACHE_MAX_ENTRIES = 50;

    const getAutomationCache = () => {
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
                matchedSelector: null,
                successCount: 0,
                lastUsedAt: 0,
                createdAt: Date.now(),
                version: null
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

    const isCacheStale = (entry) => {
        if (!entry || !entry.createdAt) return true;
        const age = Date.now() - entry.createdAt;
        return age > CACHE_TTL_MS;
    };

    const enforceCacheLimit = () => {
        const cache = getAutomationCache();
        const entries = Object.keys(cache.elements);

        if (entries.length <= CACHE_MAX_ENTRIES) return;

        const entriesWithAge = entries.map(key => ({
            key,
            lastUsedAt: cache.elements[key].lastUsedAt || cache.elements[key].createdAt || 0
        }));

        entriesWithAge.sort((a, b) => a.lastUsedAt - b.lastUsedAt);

        const toRemove = entriesWithAge.slice(0, entries.length - CACHE_MAX_ENTRIES);
        for (const entry of toRemove) {
            delete cache.elements[entry.key];
        }
    };

    const getCachedElement = (kind, lookup, diagnostics) => {
        const entry = getCacheEntry(kind, lookup);

        if (isCacheStale(entry)) {
            if (entry.element) {
                entry.element = null;
                entry.matchedSelector = null;
            }
            return null;
        }

        const element = entry.element;

        if (element && element.isConnected !== false) {
            diagnostics.cacheHits += 1;
            diagnostics.strategy = 'cache';
            diagnostics.matchedSelector = entry.matchedSelector || diagnostics.requestedSelector || null;
            entry.lastUsedAt = Date.now();
            entry.successCount = (entry.successCount || 0) + 1;
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
        entry.lastUsedAt = Date.now();
        entry.successCount = (entry.successCount || 0) + 1;
        entry.createdAt = Date.now();

        enforceCacheLimit();
    };
\n`
