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

        // Blocklist knocks out nav/utility buttons before scoring
        const SEND_BLOCKLIST = [
            /(^|\\s|-|_)(new|newchat|new-chat|new_chat|newconversation|new-conversation)(\\s|-|_|$)/i,
            /(^|\\s|-|_)(close|sidebar|menu|settings|options|model|picker|theme|dark|light|logout|sign[-_ ]?out|profile|account)(\\s|-|_|$)/i,
            /(^|\\s|-|_)(attach|upload|file|image|emoji|gif|mic|microphone|voice|speak|stop|pause|cancel|clear|delete|edit|copy|share|bookmark|pin|archive|more)(button|btn)?(\\s|-|_|$)/i,
            /^(nav|header|aside|footer|sidebar)/i
        ];
        const isLikelySendButton = (el) => {
            if (!el || el.disabled) return false;
            const text = String(
                (el.getAttribute('aria-label') || el.getAttribute('title') ||
                 el.innerText || el.textContent || '')
            ).toLowerCase().trim();
            for (const pattern of SEND_BLOCKLIST) {
                if (pattern.test(text)) return false;
            }
            if (/\\b(send|g(ö|o)nder|submit|env(í|i)ar|envoyer|senden)\\b/i.test(text)) return true;
            if (!text) {
                try {
                    const inForm = el.closest && el.closest('form, [role="form"]');
                    const hasHostChain = typeof config !== 'undefined' && config && config.fingerprint && config.fingerprint.hostChain && config.fingerprint.hostChain.length;
                    if (inForm && hasHostChain) {
                        return true;
                    }
                } catch (_) {}
                return false;
            }
            try {
                const inForm = el.closest && el.closest('form, [role="form"]');
                const hasHostChain = typeof config !== 'undefined' && config && config.fingerprint && config.fingerprint.hostChain && config.fingerprint.hostChain.length;
                if (inForm && hasHostChain) {
                    return true;
                }
            } catch (_) {}
            return false;
        };

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
                    root.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(el => candidates.push(el));
                } catch {}
                try {
                    root.querySelectorAll('[role="button"], button').forEach(el => {
                        if (candidates.indexOf(el) === -1 && isLikelySendButton(el)) {
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

        return {
            element: best.element,
            matchedSelector: best.matchedSelector,
            strategy: 'semantic'
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
