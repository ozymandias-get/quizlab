export const domSearchHelpers = `    /**
     * Escapes a string for use inside a CSS attribute value selector ("...").
     * Unlike CSS.escape (identifier escaping), this applies CSS string escaping
     * rules: backslash and double-quote must be escaped with a backslash.
     */
    const __escapeCssStr = (value) => {
        if (typeof value !== 'string') return '';
        return value.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
    };

    const collectShadowRoots = (root, accumulator, visitedHosts) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node && node.shadowRoot && !visitedHosts.has(node)) {
                visitedHosts.add(node);
                accumulator.push(node.shadowRoot);
                collectShadowRoots(node.shadowRoot, accumulator, visitedHosts);
            }
        }
    };

    const getSearchRoots = () => {
        const roots = [document];
        collectShadowRoots(document, roots, new Set());
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
     * Higher score = better match. Used to disambiguate when a CSS selector
     * matches multiple elements (e.g. multiple [role="button"] on the page).
     */
    const __fingerprintMatchScore = (element, fingerprint) => {
        if (!fingerprint || !element) return 0;
        // Guard: only score Element nodes (nodeType 1) that are still in the DOM.
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

        // Ambiguous: multiple elements match. Try disambiguation.
        // First, try fingerprint-based scoring if available — this is the
        // most reliable way to pick the RIGHT element when multiple elements
        // share the same selector (e.g. multiple [role="button"] on the page).
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
            // Only use fingerprint match if confidence is high enough (>20)
            // to avoid picking a random element with a weak match.
            if (bestCandidate && bestScore > 20) {
                const strategy = directMatches.includes(bestCandidate) ? 'direct' : 'recursive';
                return {
                    element: bestCandidate,
                    matchedSelector: selector,
                    strategy
                };
            }
        }

        // Fallback: pickPrimaryInputCandidate works well for inputs; for
        // buttons, prefer proximity to the input element if available.
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

        // Even in 'reject' mode, if we can confidently disambiguate using
        // visibility + area, return the best candidate instead of null.
        // This prevents "submit selector not found" when multiple buttons
        // share the same [role="button"] selector but only one is visible.
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
            // Multiple matches — use fingerprint to pick the best one.
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

    const findElementByFingerprint = (fingerprint) => {
        if (!fingerprint || typeof fingerprint !== 'object') {
            return null;
        }

        const root = findRootFromHostChain(fingerprint.hostChain);
        if (!root) {
            return null;
        }

        const tag = typeof fingerprint.tag === 'string' && fingerprint.tag
            ? fingerprint.tag.toLowerCase()
            : '*';

        const selectorCandidates = [];
        if (fingerprint.safeId) {
            selectorCandidates.push('#' + CSS.escape(fingerprint.safeId));
        }
        if (fingerprint.dataTestId) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[data-testid="' + __escapeCssStr(fingerprint.dataTestId) + '"]');
            selectorCandidates.push('[data-testid="' + __escapeCssStr(fingerprint.dataTestId) + '"]');
        }
        if (fingerprint.name) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[name="' + __escapeCssStr(fingerprint.name) + '"]');
        }
        if (fingerprint.placeholder) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[placeholder="' + __escapeCssStr(fingerprint.placeholder) + '"]');
        }
        if (fingerprint.ariaLabel) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[aria-label="' + __escapeCssStr(fingerprint.ariaLabel) + '"]');
        }
        if (Array.isArray(fingerprint.classTokens) && fingerprint.classTokens.length > 0 && tag !== '*') {
            selectorCandidates.push(tag + fingerprint.classTokens.map((token) => '.' + CSS.escape(token)).join(''));
        }
        if (fingerprint.role) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[role="' + __escapeCssStr(fingerprint.role) + '"]');
        }
        if (fingerprint.type && tag !== '*') {
            selectorCandidates.push(tag + '[type="' + __escapeCssStr(fingerprint.type) + '"]');
        }
        if (fingerprint.contentEditable && tag !== '*') {
            selectorCandidates.push(tag + '[contenteditable="true"]');
        }

        for (const selector of uniqueStrings(selectorCandidates)) {
            const element = findUniqueInRoot(root, selector);
            if (element && matchesClassTokens(element, fingerprint.classTokens)) {
                return {
                    element,
                    matchedSelector: selector,
                    strategy: 'fingerprint'
                };
            }
        }

        if (fingerprint.text) {
            const normalizedText = normalizeText(fingerprint.text);
            const element = findElementByPredicate(root, tag, (candidate) => {
                const text = normalizeText(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || candidate.getAttribute('title'));
                return text === normalizedText && matchesClassTokens(candidate, fingerprint.classTokens);
            }, fingerprint);

            if (element) {
                return {
                    element,
                    matchedSelector: 'text:' + normalizedText,
                    strategy: 'fingerprint'
                };
            }
        }

        const descriptorElement = findElementByPredicate(root, tag, (candidate) => {
            if (fingerprint.role && candidate.getAttribute('role') !== fingerprint.role) return false;
            if (fingerprint.type && candidate.getAttribute('type') !== fingerprint.type) return false;
            if (fingerprint.contentEditable && !(candidate.isContentEditable || candidate.getAttribute('contenteditable') === 'true')) return false;
            if (fingerprint.name && candidate.getAttribute('name') !== fingerprint.name) return false;
            if (fingerprint.placeholder && candidate.getAttribute('placeholder') !== fingerprint.placeholder) return false;
            if (fingerprint.ariaLabel && candidate.getAttribute('aria-label') !== fingerprint.ariaLabel) return false;
            if (!matchesClassTokens(candidate, fingerprint.classTokens)) return false;
            return true;
        }, fingerprint);

        if (descriptorElement) {
            return {
                element: descriptorElement,
                matchedSelector: 'fingerprint:descriptor',
                strategy: 'fingerprint'
            };
        }

        if (Array.isArray(fingerprint.localPath) && fingerprint.localPath.length > 0 && typeof root.querySelector === 'function') {
            const localSelector = fingerprint.localPath.join(' > ');
            const element = findUniqueInRoot(root, localSelector);
            if (element) {
                return {
                    element,
                    matchedSelector: localSelector,
                    strategy: 'fingerprint'
                };
            }
        }

        return null;
    };
\n`
