export const fallbackPipeline = `    /**
     * Composer kabuğundaki gerçek gönder düğmesine verilen ek puan.
     * Sayfa genelinde toplanan submit düğmeleri arasında bu, "bu sohbetin gönder
     * düğmesi" demektir: 2026-10-17 ölçümünde sayfada 7 adet
     * button[type="submit"] vardı (6'sı diyalogların "Kapat" düğmesi) ve
     * puanları eşit olduğu için sıralama ilk bulduğunu seçiyordu.
     *
     * Ölçüm düzeltmesi: canlı chatgpt.com'da gönder düğmesinin
     * data-composer-submit özniteliği YOK — tek kanca type="submit".
     * __isComposerSubmitControl ikisini de kabul ediyor.
     */
    const SEMANTIC_COMPOSER_SUBMIT_BONUS = 30;

    const __semanticConfidenceLevel = (score, baseLevel) => {
        // Bütünleşik runtime'da __toConfidenceLevel mevcuttur (selectorRepairRuntime
        // bu template'ten önce enjekte edilir). Yalnız-izole harness'lar
        // computeConfidenceScore'un döndürdüğü seviyeye düşer.
        if (typeof __toConfidenceLevel === 'function') return __toConfidenceLevel(score);
        return baseLevel;
    };

    const runFallbackPipeline = (kind, config, diagnostics, depth) => {
        const strategies = [
            { name: 'semantic', fn: trySemanticFallback },
            { name: 'provider', fn: tryProviderStrategy },
            { name: 'siteStrategy', fn: trySiteStrategy },
            { name: 'heuristic', fn: tryLastResortHeuristic }
        ];

        for (let i = 0; i <= depth && i < strategies.length; i++) {
            const strategy = strategies[i];
            const stepStart = now();
            let resolved = null;

            try {
                const candidate = strategy.fn(kind, config);
                if (candidate && candidate.element) {
                    const confidence = computeConfidenceScore(candidate, kind, config);
                    const rejected =
                        confidence.level === 'low' ||
                        (confidence.level === 'medium' && depth < 2);

                    if (!rejected) {
                        diagnostics.confidenceScore = confidence.score;
                        diagnostics.confidenceLevel = confidence.level;
                        resolved = {
                            element: candidate.element,
                            matchedSelector: candidate.matchedSelector || strategy.name + ':auto',
                            strategy: strategy.name
                        };
                        // Target integrity: preserve the runner-up gap when the
                        // strategy reports one (semantic does). The pipeline
                        // used to drop it here, which silently disabled BOTH
                        // the fail-safe gate in queryElementWithPipeline AND
                        // the ambiguity refusal in __annotateSelectorResolution —
                        // near-tied twins were then acted on AND staged.
                        if (candidate && typeof candidate.scoreGap === 'number') {
                            resolved.scoreGap = candidate.scoreGap;
                        }
                    }
                }
            } catch {
                resolved = null;
            }

            // The per-step budget guards how long we keep *starting* new
            // strategies. It must not discard an element this step already
            // found: a break inside a finally block is an abrupt completion
            // that overrides the step's pending return, so a strategy that
            // resolved slowly (> __FALLBACK_STEP_TIMEOUT_MS) used to throw its
            // result away and end the whole pipeline.
            if (resolved) return resolved;

            if (now() - stepStart > __FALLBACK_STEP_TIMEOUT_MS) {
                break;
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
        // Diktasyon kabuğu yalnızca butun dalında lazım; input dalında hiç
        // çağrılmaz (sitenin gönder düğmesiyle ilgisi yok).
        const composerContainer = kind === 'button' ? __findComposerContainer(true) : null;

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
            // Diktasyon (ses/mikrofon) düğmeleri ayrıca ve önceden elenir:
            // ölçülen chatgpt.com dikte düğmesinin data özniteliği yok, yalnız
            // aria-label'ı var ("Dikte et"), bu yüzden data listesi tek başına
            // yetmiyor.
            const buttonLookup = config ? config.button : null;
            for (const root of roots) {
                try {
                    root.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(el => {
                        if (!__isDictationControl(el)) candidates.push(el);
                    });
                } catch {}
                try {
                    root.querySelectorAll('[role="button"], button').forEach(el => {
                        if (candidates.indexOf(el) === -1
                            && !__isDictationControl(el)
                            && __isLikelySendButton(el, buttonLookup)) {
                            candidates.push(el);
                        }
                    });
                } catch {}
            }
        }

        const unique = uniqueElements(candidates);
        if (unique.length === 0) return null;

        const scored = unique.map(el => {
            const base = computeConfidenceScore({ element: el }, kind, config);
            const entry = {
                element: el,
                matchedSelector: el.tagName.toLowerCase(),
                strategy: 'semantic',
                score: base.score,
                level: base.level
            };
            if (kind !== 'button' || !__isComposerSubmitControl(el, composerContainer)) return entry;
            entry.score = base.score + SEMANTIC_COMPOSER_SUBMIT_BONUS;
            entry.level = __semanticConfidenceLevel(entry.score, base.level);
            return entry;
        });

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
