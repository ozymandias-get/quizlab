export const fallbackHeuristics = `    const isChatGptHost = () => {
        try {
            const h = (window.location.hostname || '').toLowerCase();
            return h === 'chatgpt.com' || h.endsWith('.chatgpt.com');
        } catch {
            return false;
        }
    };

    const isGeminiHost = () => {
        try {
            const h = (window.location.hostname || '').toLowerCase();
            return h === 'gemini.google.com' || h.endsWith('.gemini.google.com');
        } catch {
            return false;
        }
    };

    /**
     * Gems (/gems, özel Gem sohbetleri) ana /app arayüzünden farklı DOM kullanabiliyor.
     * Kayıtlı selektörler eşleşmezse alt bölgedeki composer’ı bul.
     */
    const tryGeminiComposerFallback = () => {
        if (!isGeminiHost()) {
            return null;
        }

        try {
            const quick = document.querySelector(
                'rich-textarea textarea, div.ql-editor[role="textbox"], textarea[placeholder*="Message" i], textarea[placeholder*="Ask" i], textarea[placeholder*="Gemini" i]'
            );
            if (quick && quick.isConnected) {
                const r = quick.getBoundingClientRect();
                const style = window.getComputedStyle(quick);
                if (
                    r.width >= 48 &&
                    r.height >= 12 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !quick.closest('header') &&
                    !quick.closest('[role="banner"]')
                ) {
                    return {
                        element: quick,
                        matchedSelector: 'gemini:known-pattern',
                        strategy: 'heuristic'
                    };
                }
            }
        } catch {
        }

        const vines = [];
        const roots = getSearchRoots();
        for (const root of roots) {
            try {
                root.querySelectorAll('textarea').forEach((el) => vines.push(el));
                root.querySelectorAll('[role="textbox"]').forEach((el) => vines.push(el));
                root.querySelectorAll('div[contenteditable="true"]').forEach((el) => vines.push(el));
            } catch {
            }
        }

        const candidates = uniqueElements(vines).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest('header') || el.closest('[role="banner"]')) return false;
            if (el.closest('[data-testid="modal"]') || el.closest('[data-state="open"][role="dialog"]')) {
                return false;
            }
            if (el.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
                return false;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 48 || r.height < 12) return false;
            if (r.bottom < -20 || r.top > window.innerHeight + 80) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        const scored = candidates.map((el) => {
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            const bottomScore = r.bottom + area * 1e-6;
            return { el, area, bottomScore };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.bottomScore - b.bottomScore) > 48) {
                return b.bottomScore - a.bottomScore;
            }
            return b.area - a.area;
        });

        const picked = scored[0].el;
        return {
            element: picked,
            matchedSelector: 'gemini:composer-fallback',
            strategy: 'heuristic'
        };
    };

    const tryGeminiButtonFallback = () => {
        if (!isGeminiHost()) {
            return null;
        }

        const vines = [];
        try {
            document.querySelectorAll('button.send-button').forEach((el) => vines.push(el));
            document.querySelectorAll('button[aria-label*="Send" i]').forEach((el) => vines.push(el));
            document.querySelectorAll('button[aria-label*="Gönder" i]').forEach((el) => vines.push(el));
            document.querySelectorAll('[role="button"][aria-label*="Send" i]').forEach((el) => vines.push(el));
            document.querySelectorAll('button[data-testid*="send" i]').forEach((el) => vines.push(el));
        } catch {
        }

        const candidates = uniqueElements(vines).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest('header') || el.closest('[role="banner"]')) return false;
            if (el.getAttribute('aria-disabled') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
                return false;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) return false;
            if (r.bottom < -20 || r.top > window.innerHeight + 120) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        const scored = candidates.map((el) => {
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            const bottomScore = r.bottom + area * 1e-6;
            return { el, area, bottomScore };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.bottomScore - b.bottomScore) > 32) {
                return b.bottomScore - a.bottomScore;
            }
            return b.area - a.area;
        });

        return {
            element: scored[0].el,
            matchedSelector: 'gemini:button-fallback',
            strategy: 'heuristic'
        };
    };

    /**
     * Project / GPT /g/.../c/... routes sometimes use a different DOM than the main chat view.
     * Saved selectors may not match or may be ambiguous — pick the main bottom composer heuristically.
     */
    const tryChatGptComposerFallback = () => {
        if (!isChatGptHost()) {
            return null;
        }

        try {
            const quick = document.querySelector(
                '#prompt-textarea, textarea[placeholder*="Message" i], textarea[placeholder*="Ask" i], [data-testid="composer-input"]'
            );
            if (quick && quick.isConnected) {
                const r = quick.getBoundingClientRect();
                const style = window.getComputedStyle(quick);
                if (
                    r.width >= 64 &&
                    r.height >= 14 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !quick.closest('header')
                ) {
                    return {
                        element: quick,
                        matchedSelector: 'chatgpt:known-pattern',
                        strategy: 'heuristic'
                    };
                }
            }
        } catch {
        }

        const vines = [];
        const roots = getSearchRoots();
        for (const root of roots) {
            try {
                root.querySelectorAll('textarea').forEach((el) => vines.push(el));
                root.querySelectorAll('[role="textbox"]').forEach((el) => vines.push(el));
            } catch {
            }
        }

        const candidates = uniqueElements(vines).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest('header') || el.closest('[role="banner"]')) return false;
            if (el.closest('[data-testid="modal"]') || el.closest('[data-state="open"][role="dialog"]')) {
                return false;
            }
            if (el.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
                return false;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 64 || r.height < 14) return false;
            if (r.bottom < -20 || r.top > window.innerHeight + 80) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        const scored = candidates.map((el) => {
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            const bottomScore = r.bottom + area * 1e-6;
            return { el, area, bottomScore };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.bottomScore - b.bottomScore) > 48) {
                return b.bottomScore - a.bottomScore;
            }
            return b.area - a.area;
        });

        const picked = scored[0].el;
        return {
            element: picked,
            matchedSelector: 'chatgpt:composer-fallback',
            strategy: 'heuristic'
        };
    };
\n`
