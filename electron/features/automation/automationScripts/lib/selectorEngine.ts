/** @file Improved selector engine – priority‑ordered, SPA‑aware, with soft cache invalidation. */

export const selectorEngine = `    /**
     * Selector öncelik tablosu. Yüksek sayı = daha kararlı.
     * İlk eşleşen selector yerine en yüksek öncelikli selector cache'lenir.
     */
    const __SELECTOR_PRIORITY = Object.freeze({
        id: 100,
        dataTestId: 90,
        ariaLabel: 75,
        role: 65,
        name: 60,
        placeholder: 50,
        type: 45,
        contentEditable: 40,
        tagClass: 25,
        tagNth: 10,
        fingerprint: 110,
        fallback: 0
    });

    const __MAX_FALLBACK_ATTEMPTS = 3;
    const __FALLBACK_STEP_TIMEOUT_MS = 500;

    /**
     * SPA navigasyonu için hafif bir dinleyici. location.href'i pushState/replaceState
     * üzerinden değiştiren sayfalar (örn. ChatGPT) için cache invalidation
     * tetikler. pushState'i monkey-patch etmek ana akışı bozmaz çünkü
     * sayfanın kendi mantığına dokunmadan yalnızca gözlemci olarak eklenir.
     */
    const __installSpaNavigationProbe = () => {
        if (window.__quizlabSpaProbeInstalled) return;
        window.__quizlabSpaProbeInstalled = true;
        try {
            const originalPush = history.pushState;
            const originalReplace = history.replaceState;
            history.pushState = function () {
                const result = originalPush.apply(this, arguments);
                window.dispatchEvent(new Event('__quizlabSpaNav'));
                return result;
            };
            history.replaceState = function () {
                const result = originalReplace.apply(this, arguments);
                window.dispatchEvent(new Event('__quizlabSpaNav'));
                return result;
            };
            window.addEventListener('popstate', () => {
                window.dispatchEvent(new Event('__quizlabSpaNav'));
            });
        } catch (e) {
            // SPA probe kurulamadıysa cache invalidation yalnızca DOM bazlı olur
        }
    };

    /**
     * SPA navigasyonu algılandığında cache'i "soft" temizler.
     */
    const __softInvalidateAllOnNav = () => {
        try {
            const cache = getAutomationCache();
            cache.elements = {};
            cache.pageUrl = window.location.href;
        } catch (e) {
            // cache boşsa yoksay
        }
    };

    if (typeof window !== 'undefined') {
        __installSpaNavigationProbe();
        window.addEventListener('__quizlabSpaNav', __softInvalidateAllOnNav);
    }

    /**
     * Selector string'inin kategorisini tahmin eder.
     * Önceliklendirme için kullanılır.
     *
     * NOT: Her regex ters eğik çizgisi TS template literal'da iki kez
     * escape edilmelidir.
     */
    const __classifySelector = (selector) => {
        const s = String(selector || '').trim();
        if (!s) return 'fallback';
        if (/^#[a-zA-Z][\\w-]*$/.test(s)) return 'id';
        if (/\\[(?:data-testid|data-test-id)\\s*=/.test(s)) return 'dataTestId';
        if (/\\[aria-label\\s*=/.test(s)) return 'ariaLabel';
        if (/\\[role\\s*=/.test(s)) return 'role';
        if (/\\[name\\s*=/.test(s)) return 'name';
        if (/\\[placeholder\\s*=/.test(s)) return 'placeholder';
        if (/\\[type\\s*=/.test(s)) return 'type';
        if (/\\[contenteditable/.test(s)) return 'contentEditable';
        if (/^\\w+\\.[\\w.-]+/.test(s) || /^\\w+\\[class\\*=/.test(s)) return 'tagClass';
        if (/:nth-child\\(/.test(s)) return 'tagNth';
        if (/^fingerprint:/.test(s)) return 'fingerprint';
        return 'fallback';
    };

    const __selectorPriority = (selector) => {
        return __SELECTOR_PRIORITY[__classifySelector(selector)] || 0;
    };

    /**
     * Selector listesini önceliğe göre azalan sırada döner.
     * Aynı kategoride alfabetik sıra (kararlı çıktı için).
     */
    const __sortSelectorsByPriority = (selectors) => {
        const list = uniqueStrings(selectors);
        return list.slice().sort((a, b) => {
            const pa = __selectorPriority(a);
            const pb = __selectorPriority(b);
            if (pa !== pb) return pb - pa;
            return a < b ? -1 : (a > b ? 1 : 0);
        });
    };

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

            // ── Soft invalidation: eleman DOM'da değilse cache'ten düşür ──
            if (result.element && !result.element.isConnected) {
                invalidateCacheEntry(kind, lookup, diagnostics);
            }

            if (fallbackAttempts < __MAX_FALLBACK_ATTEMPTS) {
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

        // Selector'ları önceliğe göre sırala (en kararlı önce)
        const selectors = __sortSelectorsByPriority(lookup && lookup.selectors);
        const fingerprint = lookup && lookup.fingerprint;
        let best = null;
        let bestPriority = -1;
        for (const selector of selectors) {
            const matched = findUniqueSelectorMatch(selector, fingerprint);
            if (matched.element) {
                const p = __selectorPriority(selector);
                if (!best || p > bestPriority) {
                    best = Object.assign({ priority: p, selector: selector }, matched);
                    bestPriority = p;
                }
                // Çok yüksek öncelikli (id/fingerprint) ise kısa devre yap
                if (p >= __SELECTOR_PRIORITY.id) break;
            }
        }

        if (best && best.element) {
            cacheElement(kind, lookup, best.matchedSelector, best.element);
            diagnostics.strategy = best.strategy;
            diagnostics.matchedSelector = best.matchedSelector;
            return best;
        }

        const fingerprintMatch = findElementByFingerprint(lookup && lookup.fingerprint);
        if (fingerprintMatch && fingerprintMatch.element) {
            cacheElement(kind, lookup, fingerprintMatch.matchedSelector, fingerprintMatch.element);
            diagnostics.strategy = 'fingerprint';
            diagnostics.matchedSelector = fingerprintMatch.matchedSelector;
            return fingerprintMatch;
        }

        if (fallbackDepth >= __MAX_FALLBACK_ATTEMPTS) {
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
            // Resolve semantic name (aria-label > title > textContent)
            const text = String(
                (el.getAttribute('aria-label') || el.getAttribute('title') ||
                 el.innerText || el.textContent || '')
            ).toLowerCase().trim();
            // Drop nav/utility controls before positive checks
            for (const pattern of SEND_BLOCKLIST) {
                if (pattern.test(text)) return false;
            }
            // Strong positive signal: words explicitly meaning "send".
            if (/\\b(send|g(ö|o)nder|submit|env(í|i)ar|envoyer|senden)\\b/i.test(text)) return true;
            // Accept icon-only buttons only if in form + hostChain
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
            // Text exists but doesn't match send patterns. Accept only if
            // inside a form AND config has hostChain (user-selected button).
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
                    // First pass: native <button> + form-submit inputs
                    root.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(el => candidates.push(el));
                } catch {}
                try {
                    // Second pass: ARIA buttons with blocklist
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

    /**
     * tryProviderStrategy artık siteStrategyRegistry'yi sarmalıyor.
     * Eski hostname listesi korunur, ama yeni stratejiler de devreye girebilir.
     */
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
