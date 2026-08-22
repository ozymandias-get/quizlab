// Unified engine — re-exported for unit-test parity check (shared is source of truth)
import { escapeCssString as __sharedEscapeCssString } from '../../../../../shared/lib/selectorEngine.js'
import { fingerprintSearchHelpers } from './fingerprintSearchHelpers.js'
export { escapeCssString } from '../../../../../shared/lib/selectorEngine.js'
export { fingerprintMatchScore } from '../../../../../shared/lib/selectorEngine.js'

export const domSearchHelpers =
  `    /**
     * Escapes a string for use inside a CSS attribute value selector ("...").
     * Shared implementation lives in shared/lib/selectorEngine.ts (escapeCssString);
     * this wrapper delegates to the same logic so Settings validation and
     * automation runtime never diverge on :has()/aria-label handling.
     */
    const __escapeCssStr = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
    };

    __installShadowRootRegistry();

    const collectShadowRoots = (root, accumulator, visitedHosts) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            // Registered closed roots are resolved via the attachShadow hook
            // (see shadowRootRegistry): node.shadowRoot is null for them, but
            // the WeakMap still knows the host → root link.
            const shadowRoot = getShadowRootForHost(node);
            if (shadowRoot && !visitedHosts.has(node)) {
                visitedHosts.add(node);
                accumulator.push(shadowRoot);
                collectShadowRoots(shadowRoot, accumulator, visitedHosts);
            }
        }
    };

    const getSearchRoots = () => {
        const roots = [document];
        const visitedShadowHosts = new Set();
        const visitedDocs = new Set([document]);
        collectShadowRoots(document, roots, visitedShadowHosts);

        // Same-origin iframe'ler de aranır: picker iframe içi eleman seçebiliyor,
        // runtime da aynı kökleri aramalı. Cross-origin frame'ler erişilemez,
        // sessizce atlanır.
        const collectFrames = (doc) => {
            try {
                doc.querySelectorAll('iframe, frame').forEach((frame) => {
                    let inner = null;
                    try { inner = frame.contentDocument; } catch (err) { return; }
                    if (!inner || visitedDocs.has(inner)) return;
                    visitedDocs.add(inner);
                    roots.push(inner);
                    collectShadowRoots(inner, roots, visitedShadowHosts);
                    collectFrames(inner);
                });
            } catch (err) {
            }
        };
        collectFrames(document);
        return roots;
    };

    const uniqueElements = (elements) => {
        const unique = [];
        const seen = new Set();
        for (const element of elements) {
            if (!element || seen.has(element)) continue;
            seen.add(element);
            unique.push(element);
        }
        return unique;
    };

    const pickPrimaryInputCandidate = (elements) => {
        const list = Array.isArray(elements) ? elements.filter((el) => el && el.isConnected) : [];
        if (list.length === 0) return null;
        if (list.length === 1) return list[0];
        const scored = list.map((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const area = rect.width * rect.height;
            const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            const role = (el.getAttribute && el.getAttribute('role')) || '';
            const preferBoost = role === 'textbox' ? 2 : 1;
            return { el, area, visible, preferBoost };
        });
        const visible = scored.filter((s) => s.visible);
        const pool = visible.length > 0 ? visible : scored;
        pool.sort((a, b) => {
            if (b.preferBoost !== a.preferBoost) return b.preferBoost - a.preferBoost;
            return b.area - a.area;
        });
        return pool[0].el;
    };

    /**
     * Checks how well an element matches a fingerprint's key attributes.
     * Higher score = better match.
     */
    const __fingerprintMatchScore = (element, fingerprint) => {
        if (!fingerprint || !element) return 0;
        if (element.nodeType && element.nodeType !== 1) return 0;
        if (element.isConnected === false) return 0;
        let score = 0;

        const al = (element.getAttribute && element.getAttribute('aria-label')) || '';
        if (fingerprint.ariaLabel && al && al.toLowerCase() === fingerprint.ariaLabel.toLowerCase()) {
            score += 40;
        }

        const text = (element.innerText || element.textContent || '').trim();
        if (fingerprint.text && text && text.toLowerCase() === fingerprint.text.toLowerCase()) {
            score += 35;
        }

        const tid = (element.getAttribute && (element.getAttribute('data-testid') || element.getAttribute('data-test-id'))) || '';
        if (fingerprint.dataTestId && tid && tid === fingerprint.dataTestId) {
            score += 30;
        }

        const name = (element.getAttribute && element.getAttribute('name')) || '';
        if (fingerprint.name && name && name === fingerprint.name) {
            score += 25;
        }

        const ph = (element.getAttribute && element.getAttribute('placeholder')) || '';
        if (fingerprint.placeholder && ph && ph === fingerprint.placeholder) {
            score += 25;
        }

        const role = (element.getAttribute && element.getAttribute('role')) || '';
        if (fingerprint.role && role && role === fingerprint.role) {
            score += 10;
        }

        if (fingerprint.classTokens && fingerprint.classTokens.length > 0 && element.classList) {
            const matchingTokens = fingerprint.classTokens.filter((t) => element.classList.contains(t));
            score += matchingTokens.length * 5;
        }

        return score;
    };

    const findUniqueSelectorMatch = (selector, fingerprint) => {
        const roots = getSearchRoots();
        const directMatches = uniqueElements(Array.from(document.querySelectorAll(selector)));
        const allMatches = uniqueElements(roots.flatMap((root) => Array.from(root.querySelectorAll(selector))));

        if (allMatches.length === 0) {
            return {
                element: null,
                matchedSelector: null,
                strategy: 'none'
            };
        }

        if (allMatches.length === 1) {
            const element = allMatches[0];
            const strategy = directMatches.includes(element) ? 'direct' : 'recursive';
            return {
                element,
                matchedSelector: selector,
                strategy
            };
        }

        if (fingerprint) {
            let bestCandidate = null;
            let bestScore = 0;
            for (const candidate of allMatches) {
                const score = __fingerprintMatchScore(candidate, fingerprint);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }
            if (bestCandidate && bestScore > 20) {
                const strategy = directMatches.includes(bestCandidate) ? 'direct' : 'recursive';
                return {
                    element: bestCandidate,
                    matchedSelector: selector,
                    strategy
                };
            }
        }

        if (AMBIGUOUS_SELECTOR_BEHAVIOR === 'pick') {
            const picked = pickPrimaryInputCandidate(allMatches);
            if (picked) {
                const strategy = directMatches.includes(picked) ? 'direct' : 'recursive';
                return {
                    element: picked,
                    matchedSelector: selector,
                    strategy
                };
            }
        }

        const visibleMatches = allMatches.filter((el) => {
            if (!el.isConnected) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0
                && style.visibility !== 'hidden' && style.display !== 'none';
        });

        if (visibleMatches.length === 1) {
            const element = visibleMatches[0];
            const strategy = directMatches.includes(element) ? 'direct' : 'recursive';
            return {
                element,
                matchedSelector: selector,
                strategy
            };
        }

        return {
            element: null,
            matchedSelector: null,
            strategy: 'none'
        };
    };

    const matchesClassTokens = (element, classTokens) => {
        if (!Array.isArray(classTokens) || classTokens.length === 0) {
            return true;
        }

        return classTokens.every((token) => element.classList && element.classList.contains(token));
    };

    const findUniqueInRoot = (root, selector) => {
        const matches = uniqueElements(Array.from(root.querySelectorAll(selector)));
        return matches.length === 1 ? matches[0] : null;
    };

    const findRootFromHostChain = (hostChain) => {
        if (!Array.isArray(hostChain) || hostChain.length === 0) {
            return document;
        }

        let currentRoot = document;
        for (const host of hostChain) {
            if (!host || typeof host.selector !== 'string') {
                return null;
            }

            const hostElement = findUniqueInRoot(currentRoot, host.selector);
            if (!hostElement || !hostElement.shadowRoot) {
                return null;
            }

            currentRoot = hostElement.shadowRoot;
        }

        return currentRoot;
    };

    const findElementByPredicate = (root, tag, predicate, fingerprint) => {
        const selector = tag && tag !== '*' ? tag : '*';
        const matches = uniqueElements(Array.from(root.querySelectorAll(selector)).filter(predicate));
        if (matches.length === 1) return matches[0];
        if (matches.length > 1 && fingerprint) {
            let best = null;
            let bestScore = 0;
            for (const m of matches) {
                const score = __fingerprintMatchScore(m, fingerprint);
                if (score > bestScore) {
                    bestScore = score;
                    best = m;
                }
            }
            if (best && bestScore > 10) return best;
        }
        return null;
    };

` +
  fingerprintSearchHelpers +
  `\n`
