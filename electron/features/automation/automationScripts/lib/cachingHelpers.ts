export const cachingHelpers = `    const CACHE_TTL_MS = 86400000;
    const CACHE_MAX_ENTRIES = 50;
    const CACHE_CONNECTED_RECHECK_MS = 5000;

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
                lastConnectedAt: 0,
                createdAt: Date.now(),
                version: null,
                repairEvidence: null
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
        entry.repairEvidence = null;
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

    /**
     * Cache hit mantığı — eski sürümde yalnızca element.isConnected kontrol
     * ediliyordu, bu da SPA re-render'larında hâlâ "true" dönebiliyordu
     * (çünkü bağlantı kopmuyor, yalnızca identity değişiyor). Yeni sürüm:
     *
     *   1. Element DOM'da mı?  (isConnected)
     *   2. matchedSelector hâlâ aynı elemana işaret ediyor mu?  (5s aralıkla recheck)
     *   3. Element selector tarafından hâlâ bulunabiliyor mu?
     *
     * Üçü de geçerse cache hit. Birinci adımda başarısız olursa hemen invalidate;
     * ikinci adım periyodik olduğu için maliyetli değil.
     */
    /**
     * Self-healing: a cache hit on a *recovered* element still counts as one
     * more real usage of that recovery. Without replaying the snapshot here the
     * consecutive-success counter would only ever advance on the very first send
     * after the DOM drift, and the promotion threshold could never be reached
     * while the cache stayed warm.
     */
    const __replayRepairEvidence = (entry, diagnostics) => {
        const evidence = entry.repairEvidence;
        if (!evidence) return;
        diagnostics.recovered = true;
        diagnostics.confidenceScore = evidence.confidenceScore;
        diagnostics.confidenceLevel = evidence.confidenceLevel;
        diagnostics.stableSelector = evidence.stableSelector;
        diagnostics.ambiguous = evidence.ambiguous;
        diagnostics.unstableSelector = evidence.unstableSelector;
        diagnostics.repairEligible = evidence.repairEligible;
        diagnostics.repairReason = evidence.repairReason;
    };

    /**
     * Cheap per-hit functional validation for a connected cache entry.
     * Returns false only on positive evidence of drift (selector no longer
     * matches the node, or the node's tag disagrees with the fingerprint).
     * Anything uncertain (marker selectors, unreadable attributes) returns
     * true so availability is preserved.
     */
    const isCacheFunctionallyValid = (element, matchedSelector, fingerprint) => {
        try {
            if (matchedSelector && typeof matchedSelector === 'string' && element.matches) {
                let matches = false;
                try {
                    matches = element.matches(matchedSelector);
                } catch (_) {
                    // Not real CSS (fingerprint:…, semantic:auto, …): skip.
                    matches = true;
                }
                if (!matches) return false;
            }
        } catch (_) {
            return true;
        }
        try {
            const expectedTag = fingerprint && typeof fingerprint.tag === 'string'
                ? fingerprint.tag.toLowerCase()
                : null;
            if (expectedTag && element.tagName) {
                if (String(element.tagName).toLowerCase() !== expectedTag) return false;
            }
            // Function drift on the SAME node (same tag, same selector still
            // matching, but the control now serves another purpose): compare
            // the saved identity attributes. A single changed attribute is
            // positive drift evidence — not uncertainty.
            if (fingerprint && element.getAttribute) {
                const pairs = [
                    ['role', fingerprint.role],
                    ['placeholder', fingerprint.placeholder],
                    ['aria-label', fingerprint.ariaLabel],
                    ['name', fingerprint.name],
                    ['type', fingerprint.type]
                ];
                for (let i = 0; i < pairs.length; i++) {
                    const attr = pairs[i][0];
                    const expected = pairs[i][1];
                    if (typeof expected === 'string' && expected) {
                        let actual = null;
                        try {
                            actual = element.getAttribute(attr);
                        } catch (_) {
                            actual = null;
                        }
                        if (actual !== expected) return false;
                    }
                }
                if (typeof fingerprint.dataTestId === 'string' && fingerprint.dataTestId) {
                    let actualTid = null;
                    try {
                        actualTid = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
                    } catch (_) {
                        actualTid = null;
                    }
                    if (actualTid !== fingerprint.dataTestId) return false;
                }
            }
        } catch (_) {
            return true;
        }
        return true;
    };

    const getCachedElement = (kind, lookup, diagnostics) => {
        const entry = getCacheEntry(kind, lookup);

        if (isCacheStale(entry)) {
            if (entry.element) {
                entry.element = null;
                entry.matchedSelector = null;
                entry.repairEvidence = null;
            }
            return null;
        }

        const element = entry.element;
        if (!element) return null;

        // Hızlı yol: isConnected false ise cache miss + invalidate
        if (element.isConnected === false) {
            invalidateCacheEntry(kind, lookup, diagnostics);
            return null;
        }

        // Target-integrity: a still-connected node may have drifted out from
        // under its selector (SPA class/attribute swap) or changed function
        // (the same selector now describes a different control). Two cheap,
        // query-free checks run on EVERY hit:
        //   1. the cached node must still match its own matchedSelector;
        //   2. its tag must still agree with the saved fingerprint tag.
        // Marker selectors (fingerprint:…, semantic:auto, …) are not CSS and
        // are skipped — they never invalidate on uncertainty.
        try {
            const functional = isCacheFunctionallyValid(element, entry.matchedSelector, lookup && lookup.fingerprint);
            if (!functional) {
                invalidateCacheEntry(kind, lookup, diagnostics);
                return null;
            }
        } catch (_) {
            // A check failure must never break automation; the periodic
            // recheck below remains the backstop.
        }

        // Periyodik recheck: matchedSelector hâlâ aynı elemana mı işaret ediyor?
        const nowMs = Date.now();
        if (entry.matchedSelector && (nowMs - (entry.lastConnectedAt || 0)) > CACHE_CONNECTED_RECHECK_MS) {
            try {
                // Search across all roots (main document + shadow DOM) so
                // cached elements inside shadow trees are not falsely invalidated.
                let recheckRoots;
                try {
                    recheckRoots = getSearchRoots();
                } catch (_) {
                    recheckRoots = [document];
                }
                let recheckFound = false;
                let recheckAmbiguous = false;
                for (const root of recheckRoots) {
                    const recheck = root.querySelectorAll(entry.matchedSelector);
                    if (recheck.length > 1) {
                        // The selector used to be unique but now matches
                        // several elements (twin composer mounted, list
                        // re-rendered). Keeping the warm entry would pin the
                        // old twin while the resolver would fail safe.
                        recheckAmbiguous = true;
                        break;
                    }
                    if (recheck.length > 0 && recheck[0] === element) {
                        recheckFound = true;
                        break;
                    }
                }
                if (recheckAmbiguous || !recheckFound) {
                    invalidateCacheEntry(kind, lookup, diagnostics);
                    return null;
                }
                entry.lastConnectedAt = nowMs;
            } catch (e) {
                // selector malformed ise cache'i silme — sadece skip
                entry.lastConnectedAt = nowMs;
            }
        }

        diagnostics.cacheHits += 1;
        diagnostics.strategy = 'cache';
        diagnostics.matchedSelector = entry.matchedSelector || diagnostics.requestedSelector || null;
        entry.lastUsedAt = nowMs;
        entry.successCount = (entry.successCount || 0) + 1;
        __replayRepairEvidence(entry, diagnostics);
        return {
            element,
            matchedSelector: diagnostics.matchedSelector,
            strategy: 'cache'
        };
    };

    const cacheElement = (kind, lookup, matchedSelector, element, repairEvidence) => {
        const entry = getCacheEntry(kind, lookup);
        entry.element = element || null;
        entry.matchedSelector = matchedSelector || null;
        entry.lastUsedAt = Date.now();
        entry.lastConnectedAt = Date.now();
        entry.successCount = (entry.successCount || 0) + 1;
        entry.createdAt = Date.now();
        entry.repairEvidence = repairEvidence || null;

        enforceCacheLimit();
    };
`
