export const domSearchHelpers = `    const collectShadowRoots = (root, accumulator, visitedHosts) => {
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

    const findUniqueSelectorMatch = (selector) => {
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

    const findElementByPredicate = (root, tag, predicate) => {
        const selector = tag && tag !== '*' ? tag : '*';
        const matches = uniqueElements(Array.from(root.querySelectorAll(selector)).filter(predicate));
        return matches.length === 1 ? matches[0] : null;
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
            selectorCandidates.push((tag !== '*' ? tag : '') + '[data-testid="' + CSS.escape(fingerprint.dataTestId) + '"]');
            selectorCandidates.push('[data-testid="' + CSS.escape(fingerprint.dataTestId) + '"]');
        }
        if (fingerprint.name) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[name="' + CSS.escape(fingerprint.name) + '"]');
        }
        if (fingerprint.placeholder) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[placeholder="' + CSS.escape(fingerprint.placeholder) + '"]');
        }
        if (fingerprint.ariaLabel) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[aria-label="' + CSS.escape(fingerprint.ariaLabel) + '"]');
        }
        if (Array.isArray(fingerprint.classTokens) && fingerprint.classTokens.length > 0 && tag !== '*') {
            selectorCandidates.push(tag + fingerprint.classTokens.map((token) => '.' + CSS.escape(token)).join(''));
        }
        if (fingerprint.role) {
            selectorCandidates.push((tag !== '*' ? tag : '') + '[role="' + CSS.escape(fingerprint.role) + '"]');
        }
        if (fingerprint.type && tag !== '*') {
            selectorCandidates.push(tag + '[type="' + CSS.escape(fingerprint.type) + '"]');
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
            });

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
        });

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
