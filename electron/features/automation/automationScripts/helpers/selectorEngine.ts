export const selectorEngine = `    const MAX_FALLBACK_ATTEMPTS = 3;
    const FALLBACK_STEP_TIMEOUT_MS = 500;

    const resolveWithFallback = async (lookup, kind, diagnostics, config, timeout = 10000, mustBeInteractive = false) => {
        const start = now();
        let attempts = 0;
        let fallbackAttempts = 0;

        while (now() - start < timeout) {
            attempts += 1;
            const result = queryElementWithPipeline(lookup, kind, diagnostics, config, fallbackAttempts);
            const element = result.element;

            if (element && (!mustBeInteractive || isReadyForInteraction(element))) {
                diagnostics.waitIterations = attempts;
                diagnostics.interactiveRequired = mustBeInteractive;
                diagnostics.durationMs = roundMs(now() - start);
                diagnostics.fallbackAttempts = fallbackAttempts;
                return result;
            }

            if (element && result.matchedSelector && result.strategy !== 'cache') {
                invalidateCacheEntry(kind, lookup, diagnostics);
            }

            if (fallbackAttempts < MAX_FALLBACK_ATTEMPTS) {
                fallbackAttempts += 1;
            }

            await wait(250);
        }

        diagnostics.waitIterations = attempts;
        diagnostics.interactiveRequired = mustBeInteractive;
        diagnostics.durationMs = roundMs(now() - start);
        diagnostics.fallbackAttempts = fallbackAttempts;
        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const queryElementWithPipeline = (lookup, kind, diagnostics, config, fallbackDepth = 0) => {
        const cached = getCachedElement(kind, lookup, diagnostics);
        if (cached) {
            return cached;
        }

        const selectors = uniqueStrings(lookup && lookup.selectors);
        for (const selector of selectors) {
            const matched = findUniqueSelectorMatch(selector);
            if (matched.element) {
                cacheElement(kind, lookup, matched.matchedSelector, matched.element);
                diagnostics.strategy = matched.strategy;
                diagnostics.matchedSelector = matched.matchedSelector;
                return matched;
            }
        }

        const fingerprintMatch = findElementByFingerprint(lookup && lookup.fingerprint);
        if (fingerprintMatch && fingerprintMatch.element) {
            cacheElement(kind, lookup, fingerprintMatch.matchedSelector, fingerprintMatch.element);
            diagnostics.strategy = 'fingerprint';
            diagnostics.matchedSelector = fingerprintMatch.matchedSelector;
            return fingerprintMatch;
        }

        if (fallbackDepth >= MAX_FALLBACK_ATTEMPTS) {
            return { element: null, matchedSelector: null, strategy: 'none' };
        }

        const fallbackResult = runFallbackPipeline(kind, config, diagnostics, fallbackDepth);
        if (fallbackResult && fallbackResult.element) {
            cacheElement(kind, lookup, fallbackResult.matchedSelector, fallbackResult.element);
            diagnostics.strategy = fallbackResult.strategy;
            diagnostics.matchedSelector = fallbackResult.matchedSelector;
            return fallbackResult;
        }

        return { element: null, matchedSelector: null, strategy: 'none' };
    };

    const runFallbackPipeline = (kind, config, diagnostics, depth) => {
        const strategies = [
            { name: 'semantic', fn: trySemanticFallback },
            { name: 'provider', fn: tryProviderStrategy },
            { name: 'heuristic', fn: tryLastResortHeuristic }
        ];

        for (let i = 0; i <= depth && i < strategies.length; i++) {
            const strategy = strategies[i];
            const stepStart = now();

            try {
                const candidate = strategy.fn(kind, config);
                if (!candidate || !candidate.element) continue;

                const confidence = computeConfidenceScore(candidate, kind, config);

                if (confidence.level === 'low') {
                    continue;
                }

                if (confidence.level === 'medium' && depth < 2) {
                    continue;
                }

                diagnostics.confidenceScore = confidence.score;
                diagnostics.confidenceLevel = confidence.level;

                return {
                    element: candidate.element,
                    matchedSelector: candidate.matchedSelector || strategy.name + ':auto',
                    strategy: strategy.name
                };
            } catch {
                continue;
            } finally {
                const elapsed = now() - stepStart;
                if (elapsed > FALLBACK_STEP_TIMEOUT_MS) {
                    break;
                }
            }
        }

        return null;
    };

    const trySemanticFallback = (kind, config) => {
        const roots = getSearchRoots();
        const candidates = [];

        if (kind === 'input') {
            for (const root of roots) {
                try {
                    root.querySelectorAll('[role="textbox"]').forEach(el => candidates.push(el));
                    root.querySelectorAll('textarea').forEach(el => candidates.push(el));
                    root.querySelectorAll('div[contenteditable="true"]').forEach(el => candidates.push(el));
                    root.querySelectorAll('input[type="text"], input[type="search"]').forEach(el => candidates.push(el));
                } catch {}
            }
        } else {
            for (const root of roots) {
                try {
                    root.querySelectorAll('[role="button"]').forEach(el => candidates.push(el));
                    root.querySelectorAll('button[type="submit"]').forEach(el => candidates.push(el));
                    root.querySelectorAll('input[type="submit"]').forEach(el => candidates.push(el));
                } catch {}
            }
        }

        const unique = uniqueElements(candidates);
        if (unique.length === 0) return null;

        const scored = unique.map(el => ({
            element: el,
            matchedSelector: el.tagName.toLowerCase(),
            strategy: 'semantic',
            ...computeConfidenceScore({ element: el }, kind, config)
        }));

        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (best.score < CONFIDENCE_THRESHOLD_MEDIUM) return null;

        return {
            element: best.element,
            matchedSelector: best.matchedSelector,
            strategy: 'semantic'
        };
    };

    const tryProviderStrategy = (kind, config) => {
        const hostname = (window.location.hostname || '').toLowerCase();

        if (hostname.includes('claude.ai')) {
            return tryClaudeStrategy(kind, config);
        }
        if (hostname.includes('deepseek.com')) {
            return tryDeepSeekStrategy(kind, config);
        }
        if (hostname.includes('qwen')) {
            return tryQwenStrategy(kind, config);
        }
        if (hostname.includes('kimi')) {
            return tryKimiStrategy(kind, config);
        }

        return null;
    };

    const tryClaudeStrategy = (kind, config) => {
        if (kind === 'input') {
            const candidates = [
                'textarea',
                'div[contenteditable="true"]',
                '.ProseMirror',
                '[data-placeholder]'
            ];
            for (const sel of candidates.slice(0, 3)) {
                try {
                    const el = document.querySelector(sel);
                    if (el && el.isConnected) {
                        const r = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        if (r.width >= 64 && r.height >= 14 && style.visibility !== 'hidden' && style.display !== 'none') {
                            return { element: el, matchedSelector: 'claude:' + sel, strategy: 'provider' };
                        }
                    }
                } catch {}
            }
        } else {
            try {
                const btn = document.querySelector('button[type="submit"], button[data-action="send"], [role="button"][aria-label*="Send" i]');
                if (btn && btn.isConnected) {
                    const r = btn.getBoundingClientRect();
                    if (r.width >= 8 && r.height >= 8) {
                        return { element: btn, matchedSelector: 'claude:button', strategy: 'provider' };
                    }
                }
            } catch {}
        }
        return null;
    };

    const tryDeepSeekStrategy = (kind, config) => {
        if (kind === 'input') {
            const candidates = [
                '[role="textbox"]',
                'textarea',
                '#chat-input',
                '.chat-input textarea'
            ];
            for (const sel of candidates.slice(0, 3)) {
                try {
                    const el = document.querySelector(sel);
                    if (el && el.isConnected) {
                        const r = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        if (r.width >= 48 && r.height >= 12 && style.visibility !== 'hidden' && style.display !== 'none') {
                            return { element: el, matchedSelector: 'deepseek:' + sel, strategy: 'provider' };
                        }
                    }
                } catch {}
            }
        } else {
            try {
                const btn = document.querySelector('button.send-btn, [aria-label*="Send" i], button[type="submit"]');
                if (btn && btn.isConnected) {
                    const r = btn.getBoundingClientRect();
                    if (r.width >= 8 && r.height >= 8) {
                        return { element: btn, matchedSelector: 'deepseek:button', strategy: 'provider' };
                    }
                }
            } catch {}
        }
        return null;
    };

    const tryQwenStrategy = (kind, config) => {
        if (kind === 'input') {
            const candidates = [
                'textarea',
                '[contenteditable="true"]',
                '.chat-input',
                '.input-area textarea'
            ];
            for (const sel of candidates.slice(0, 3)) {
                try {
                    const el = document.querySelector(sel);
                    if (el && el.isConnected) {
                        const r = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        if (r.width >= 48 && r.height >= 12 && style.visibility !== 'hidden' && style.display !== 'none') {
                            return { element: el, matchedSelector: 'qwen:' + sel, strategy: 'provider' };
                        }
                    }
                } catch {}
            }
        } else {
            try {
                const btn = document.querySelector('.send-btn, [aria-label*="Send" i], button[type="submit"]');
                if (btn && btn.isConnected) {
                    const r = btn.getBoundingClientRect();
                    if (r.width >= 8 && r.height >= 8) {
                        return { element: btn, matchedSelector: 'qwen:button', strategy: 'provider' };
                    }
                }
            } catch {}
        }
        return null;
    };

    const tryKimiStrategy = (kind, config) => {
        if (kind === 'input') {
            const candidates = [
                'textarea',
                '[role="textbox"]',
                '.input-area',
                '.chat-input textarea'
            ];
            for (const sel of candidates.slice(0, 3)) {
                try {
                    const el = document.querySelector(sel);
                    if (el && el.isConnected) {
                        const r = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        if (r.width >= 48 && r.height >= 12 && style.visibility !== 'hidden' && style.display !== 'none') {
                            return { element: el, matchedSelector: 'kimi:' + sel, strategy: 'provider' };
                        }
                    }
                } catch {}
            }
        } else {
            try {
                const btn = document.querySelector('.send-btn, [aria-label*="Send" i], button[type="submit"]');
                if (btn && btn.isConnected) {
                    const r = btn.getBoundingClientRect();
                    if (r.width >= 8 && r.height >= 8) {
                        return { element: btn, matchedSelector: 'kimi:button', strategy: 'provider' };
                    }
                }
            } catch {}
        }
        return null;
    };

    const tryLastResortHeuristic = (kind, config) => {
        if (kind === 'input') {
            const chatgptFallback = tryChatGptComposerFallback();
            if (chatgptFallback && chatgptFallback.element) return chatgptFallback;
            const geminiInputFallback = tryGeminiComposerFallback();
            if (geminiInputFallback && geminiInputFallback.element) return geminiInputFallback;
        } else {
            const geminiButtonFallback = tryGeminiButtonFallback();
            if (geminiButtonFallback && geminiButtonFallback.element) return geminiButtonFallback;
        }
        return null;
    };
\n`
