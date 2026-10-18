/** @file Improved selector engine – priority‑ordered, SPA‑aware, with soft cache invalidation. */
// Injected into the page, so it cannot import a shared module. This script is
// the runtime source of truth for selector classification and priority.
import { fallbackPipeline } from './fallbackPipeline.js'

export const selectorEngine =
  `    /**
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
     * tetikler.
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
        // Guarded like the probe itself: every script injection re-evaluates
        // this block, and an unguarded addEventListener with a fresh closure
        // identity could never be removed. That left one listener per send,
        // each fanning out a full cache reset on every pushState.
        if (!window.__quizlabSpaNavListenerInstalled) {
            window.__quizlabSpaNavListenerInstalled = true;
            window.addEventListener('__quizlabSpaNav', __softInvalidateAllOnNav);
        }
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

    /**
     * \`mustBeInteractive\` beklerken bulunan ama etkileşime hazır olmayan
     * \`stableBlockedExitMs\` parametresi, kapıdan erken çıkmayı sağlar.
     *
     * Arka plan: metin doğrulandıktan sonra gönder butonu "kararlı biçimde
     * disabled" kalmaya devam ederse, sorun bekleme değildir — editörün iç
     * modeli metni almamıştır (DOM'a eklenmiş olabilir). Böyle bir durumda
     * 15 saniyeyi doldurmak yalnızca kullanıcıyı bekletir, sonucu değiştirmez.
     *
     * Varsayılan 0 = kapalıdır; yalnızca submit butonu beklemesi açıkça
     * etkinleştirir. Bu sayede selectorEngine'ın tek başına test harness'leri
     * (\`isReadyForInteraction\` stub'layan) davranış değişimi görmez.
     *
     * Başarısız dönüş artık \`blockedElement\` + \`notReadyReason\` taşır:
     * çağıran taraf "bulunamadı" ile "bulundu ama pasif" ayrımını yapabilir
     * ve kullanıcıya yanlış biçimde "selector'ını yeniden seç" demez.
     */
    const resolveWithFallback = async (lookup, kind, diagnostics, config, timeout = 10000, mustBeInteractive = false, stableBlockedExitMs = 0) => {
        const start = now();
        let attempts = 0;
        let fallbackAttempts = 0;
        let blockedElement = null;
        let blockedReason = null;
        let stableBlockedSince = 0;
        let aborted = false;

        while (now() - start < timeout) {
            if (typeof isAborted === 'function' && isAborted()) {
                aborted = true;
                break;
            }
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

            if (element) {
                // Bulundu ama etkileşime hazır değil: engeli kaydet.
                blockedElement = element;
                blockedReason = typeof describeNotReady === 'function' ? describeNotReady(element) : 'not_interactive';
                if (stableBlockedExitMs > 0 && typeof isStableBlockedReason === 'function' && isStableBlockedReason(blockedReason)) {
                    if (stableBlockedSince === 0) {
                        stableBlockedSince = now();
                    } else if (now() - stableBlockedSince >= stableBlockedExitMs) {
                        break;
                    }
                } else {
                    stableBlockedSince = 0;
                }
            }

            if (result.element && !result.element.isConnected) {
                invalidateCacheEntry(kind, lookup, diagnostics);
            }

            if (fallbackAttempts < __MAX_FALLBACK_ATTEMPTS) {
                fallbackAttempts += 1;
            }

            await wait(250);
        }

        // ÖLÜ BÖLGE KAPATMA.
        //
        // Döngünün son adımı \`await wait(250)\` olduğu için bütçenin son
        // ~250ms'i HİÇBİR kontrol yapılmadan geçer: \`while (now() - start <
        // timeout)\` koşulu bir sonraki turda \`false\` olur ve o tur hiç
        // çalışmaz. Ölçüm: 1000ms bütçede son başarılı varış 750ms, 2000ms
        // bütçede 1800ms — yani bütçenin %25'i kullanılamaz duruyor.
        //
        // Düzeltme, \`__eventDrivenWait\`'in kendi çıkış deseniyle aynıdır
        // (eventDrivenWait.ts, "timeout'a düştük — son bir kontrol daha"):
        // döngü bittiğinde bir tur daha taranır. Böylece "varış + ~250ms <
        // bütçe" kuralı her bütçede geçerli olur.
        //
        // İptal (abort) ve kararlı-pasiflik erken çıkışlarında tur sayacı
        // ARTIRILMAZ: \`waitIterations\` bir tur sayacıdır ve sayaç tabanlı
        // ölçümler (etkin buton ilk turda bulunmalı) bozulmamalıdır.
        if (!aborted) {
            const finalResult = queryElementWithPipeline(lookup, kind, diagnostics, config, fallbackAttempts);
            const finalElement = finalResult.element;
            if (finalElement) {
                if (!mustBeInteractive || isReadyForInteraction(finalElement)) {
                    attempts += 1;
                    diagnostics.waitIterations = attempts;
                    diagnostics.interactiveRequired = mustBeInteractive;
                    diagnostics.durationMs = roundMs(now() - start);
                    diagnostics.fallbackAttempts = fallbackAttempts;
                    return finalResult;
                }
                blockedElement = finalElement;
                blockedReason = typeof describeNotReady === 'function'
                    ? describeNotReady(finalElement)
                    : 'not_interactive';
            }
        }

        diagnostics.waitIterations = attempts;
        diagnostics.interactiveRequired = mustBeInteractive;
        diagnostics.durationMs = roundMs(now() - start);
        diagnostics.fallbackAttempts = fallbackAttempts;
        return {
            element: null,
            matchedSelector: null,
            strategy: 'none',
            blockedElement: blockedElement,
            notReadyReason: blockedReason
        };
    };

    const queryElementWithPipeline = (lookup, kind, diagnostics, config, fallbackDepth = 0) => {
        const cached = getCachedElement(kind, lookup, diagnostics);
        if (cached) {
            return cached;
        }

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
                if (p >= __SELECTOR_PRIORITY.id) break;
            }
        }

        if (best && best.element) {
            // A non-primary entry of the candidate list only counts as a
            // *recovery* when the saved primary genuinely stopped matching.
            // Priority ordering can legitimately prefer another candidate (and
            // reporting that as a recovery would be noise), so the primary is
            // probed before relabelling. The probe only runs when a non-primary
            // selector won, so the common fast path stays untouched.
            const savedPrimary = lookup && Array.isArray(lookup.selectors) ? lookup.selectors[0] : null;
            if (savedPrimary && best.selector && best.selector !== savedPrimary) {
                const primaryMatch = findUniqueSelectorMatch(savedPrimary, fingerprint);
                if (!primaryMatch.element) {
                    best.strategy = 'candidate';
                }
            }
            diagnostics.strategy = best.strategy;
            diagnostics.matchedSelector = best.matchedSelector;
            // Self-healing: annotate the resolution so the renderer can learn
            // from it. __annotateSelectorResolution short-circuits for
            // direct/primary hits, so the fast path stays free.
            const evidence = __annotateSelectorResolution(diagnostics, kind, best, config);
            cacheElement(kind, lookup, best.matchedSelector, best.element, evidence);
            return best;
        }

        const fingerprintMatch = findElementByFingerprint(lookup && lookup.fingerprint);
        if (fingerprintMatch && fingerprintMatch.element) {
            diagnostics.strategy = 'fingerprint';
            diagnostics.matchedSelector = fingerprintMatch.matchedSelector;
            const fingerprintEvidence = __annotateSelectorResolution(
                diagnostics,
                kind,
                fingerprintMatch,
                config
            );
            cacheElement(
                kind,
                lookup,
                fingerprintMatch.matchedSelector,
                fingerprintMatch.element,
                fingerprintEvidence
            );
            return fingerprintMatch;
        }

        // NOTE: no "give up on the fallback pipeline" guard here. The depth
        // argument is a strategy cursor, not an attempt budget: it saturates at
        // __MAX_FALLBACK_ATTEMPTS, which is the index that makes
        // runFallbackPipeline walk the whole strategy list (it bounds itself
        // with i <= depth && i < strategies.length). An earlier
        // "fallbackDepth >= __MAX_FALLBACK_ATTEMPTS" bail-out both disabled
        // recovery for the remaining ~9s of the 10s window and made the
        // last-resort heuristic unreachable, because depth never exceeded the
        // cap.
        const fallbackResult = runFallbackPipeline(kind, config, diagnostics, fallbackDepth);
        if (fallbackResult && fallbackResult.element) {
            // Target integrity: a recovery whose two best candidates scored
            // too close cannot identify the picked element — acting on it
            // would operate on an arbitrary twin (wrong composer, wrong send
            // button). Fail safe instead: the error classifier turns this
            // into a re-pick requirement, and a fresh pick mints a new
            // localPath that disambiguates. Unambiguous recoveries (a lone
            // candidate reports its full score as the gap) are unaffected, so
            // single-composer drift recovery keeps working in every mode.
            const minGap = (typeof REPAIR_MIN_AUTO_REPAIR_SCORE_GAP === 'number')
                ? REPAIR_MIN_AUTO_REPAIR_SCORE_GAP
                : 15;
            if (typeof fallbackResult.scoreGap === 'number' && fallbackResult.scoreGap < minGap) {
                diagnostics.strategy = 'none';
                diagnostics.matchedSelector = null;
                diagnostics.ambiguous = true;
                diagnostics.repairEligible = false;
                diagnostics.repairReason = 'ambiguous_candidates';
                return { element: null, matchedSelector: null, strategy: 'none' };
            }
            diagnostics.strategy = fallbackResult.strategy;
            diagnostics.matchedSelector = fallbackResult.matchedSelector;
            const fallbackEvidence = __annotateSelectorResolution(
                diagnostics,
                kind,
                fallbackResult,
                config
            );
            cacheElement(
                kind,
                lookup,
                fallbackResult.matchedSelector,
                fallbackResult.element,
                fallbackEvidence
            );
            return fallbackResult;
        }

        return { element: null, matchedSelector: null, strategy: 'none' };
    };

` +
  fallbackPipeline +
  `\n`
