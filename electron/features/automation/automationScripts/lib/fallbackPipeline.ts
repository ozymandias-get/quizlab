export const fallbackPipeline = `    const runFallbackPipeline = (kind, config, diagnostics, depth) => {
        const strategies = [
            { name: 'semantic', fn: trySemanticFallback },
            { name: 'provider', fn: tryProviderStrategy },
            { name: 'siteStrategy', fn: trySiteStrategy },
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
                if (elapsed > __FALLBACK_STEP_TIMEOUT_MS) {
                    break;
                }
            }
        }

        return null;
    };

    /**
     * Yeni site strategy registry'sini çağırır. tryProviderStrategy sabit
     * hostname listesine bağlıydı; siteStrategyRegistry dinamik kayıt alır.
     */
    const trySiteStrategy = (kind, config) => {
        try {
            const hostname = (window.location.hostname || '').toLowerCase();
            const matches = __listApplicableStrategies(hostname);
            for (let i = 0; i < matches.length; i++) {
                const strategy = matches[i];
                try {
                    const candidate = strategy.produce(kind);
                    if (candidate && candidate.element) {
                        return Object.assign({
                            matchedSelector: strategy.id + ':' + (candidate.matchedSelector || 'auto')
                        }, candidate);
                    }
                } catch (_) {
                    continue;
                }
            }
        } catch (_) {
            // ignore
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
            // Blocklist knocks out nav/utility buttons before scoring. The rule
            // itself lives in selectorRepairRuntime (SEND_LABEL_BLOCKLIST) so
            // runtime selection and persisted auto-repair cannot disagree.
            const buttonLookup = config ? config.button : null;
            for (const root of roots) {
                try {
                    root.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(el => candidates.push(el));
                } catch {}
                try {
                    root.querySelectorAll('[role="button"], button').forEach(el => {
                        if (candidates.indexOf(el) === -1 && __isLikelySendButton(el, buttonLookup)) {
                            candidates.push(el);
                        }
                    });
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

        // Score gap to the runner-up travels with the candidate so the
        // self-healing evidence can refuse to persist an ambiguous recovery.
        const runnerUp = scored[1];
        const scoreGap = runnerUp ? best.score - runnerUp.score : best.score;

        return {
            element: best.element,
            matchedSelector: best.matchedSelector,
            strategy: 'semantic',
            scoreGap: scoreGap
        };
    };

    const tryProviderStrategy = (kind, config) => {
        return trySiteStrategy(kind, config);
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
`
