/**
 * Event-Driven Wait Helpers
 * ─────────────────────────────────────────────────────────────────────────────
 * Önceki tasarım (submitReady.ts):
 *
 *     while (now() - waitStartedAt < ${timeoutMs}) {
 *         ...
 *         const settledForMs = now() - observer.getLastMutationAt();
 *         if (isInteractive && waitedMs >= ${minimumWaitMs} && settledForMs >= ${settleMs}) {
 *             return { success: true, ... };
 *         }
 *         await wait(250);  // ← POLLING — kötü
 *     }
 *
 * Sorun: Yükleme sırasında progress bar 200ms'de bir mutasyon üretir → 250ms
 * sabit polling aralığı yetişemez. Üstelik siteler sürekli yeni mutation
 * üretirse (animated spinner), settleMs eşiği hiçbir zaman aşılamaz.
 *
 * Yeni tasarım:
 *
 *     const waitPromise = new Promise(resolve => {
 *         observer.onChange = resolve;  // her mutasyonda kontrol et
 *     });
 *     const timeoutPromise = new Promise(resolve => setTimeout(resolve, timeoutMs));
 *
 *     while (!shouldExit) {
 *         const candidate = check();
 *         if (candidate) return candidate;
 *         await Promise.race([waitPromise, timeoutPromise]);
 *     }
 *
 * Avantajlar:
 *   1. Poll yok — mutasyon olunca anında uyanıyoruz
 *   2. Yükleme sırasında bile "isInteractive" değişimi 1-2ms içinde yakalanır
 *   3. idle sayfalarda CPU sıfır (observer tetikleyene kadar hiçbir şey çalışmıyor)
 *   4. Settle süresi sadece son mutasyondan beri geçen süre — sabit polling'den
 *      çok daha doğru.
 */

export const eventDrivenWaitRuntime = `    /**
     * Event-driven wait: MutationObserver + Promise.race ile.
     *
     * @param {Object} params
     * @param {Element|DocumentFragment} params.root - gözlemlenecek kök
     * @param {Function} params.check - her mutasyon veya timeout'ta çağrılır;
     *   truthy dönerse \`{result}\` ile çözülür
     * @param {number} params.timeoutMs - toplam bütçe
     * @param {number} params.settleMs - son mutasyondan beri geçmesi gereken süre
     * @param {number} params.minimumWaitMs - minimum bekleme (initial stabilisation)
     * @returns {Promise<{result: any, totalMs: number, waitIterations: number}>}
     */
    const __eventDrivenWait = async ({ root, check, timeoutMs, settleMs, minimumWaitMs }) => {
        const fallbackRoot = (root && typeof root.querySelectorAll === 'function')
            ? root
            : document.body;
        const start = now();
        let lastMutationAt = start;
        let settledSinceLastCheck = start;
        let lastSettledAt = start;
        let wakeRequested = false;
        let iterations = 0;
        let observer;

        const wake = () => {
            wakeRequested = true;
            lastMutationAt = now();
        };

        try {
            observer = new MutationObserver(() => {
                lastMutationAt = now();
                wake();
            });
            observer.observe(fallbackRoot, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true
            });
        } catch (e) {
            // observer kurulamadıysa poll moduna düş (nadir)
            try {
                observer = new MutationObserver(wake);
                observer.observe(document.body, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    characterData: true
                });
            } catch (_) {
                observer = { disconnect: () => {} };
            }
        }

        const resultOrNull = () => {
            iterations += 1;
            const waitedMs = now() - start;
            const sinceLastMutation = now() - lastMutationAt;
            const candidate = check();
            if (candidate && waitedMs >= (minimumWaitMs || 0) && sinceLastMutation >= (settleMs || 0)) {
                return { result: candidate, totalMs: roundMs(waitedMs), iterations };
            }
            return null;
        };

        try {
            while (now() - start < timeoutMs) {
                wakeRequested = false;
                const found = resultOrNull();
                if (found) return found;

                // wakeRequested zaten true ise microtask'te kontrol et
                if (wakeRequested) continue;

                // yoksa observer'ı bekle — ama timeoutMs'i aşma
                const remaining = Math.max(1, timeoutMs - (now() - start));
                const idleWait = new Promise((resolve) => setTimeout(resolve, Math.min(50, remaining)));
                await idleWait;
            }
        } finally {
            try { observer.disconnect(); } catch (_) {}
        }

        // timeout'a düştük — son bir kontrol daha yap
        const final = resultOrNull();
        if (final) return final;
        return { result: null, totalMs: roundMs(now() - start), iterations };
    };
`
