export const fingerprintSearchHelpers = `    // Cross-root twin guards. A selector or predicate that identifies an
    // element in one root must not silently win when another root (main
    // document vs iframe vs shadow tree) holds an identical twin — e.g.
    // duplicated ids across roots. Both counters early-exit past 1: only
    // "exactly one" vs "more than one" matters.
    const __countSelectorMatchesAcrossRoots = (roots, selector) => {
        let total = 0;
        const list = Array.isArray(roots) ? roots : [];
        for (let i = 0; i < list.length; i++) {
            const root = list[i];
            if (!root || typeof root.querySelectorAll !== 'function') continue;
            try {
                total += root.querySelectorAll(selector).length;
                if (total > 1) return total;
            } catch (_) {
                continue;
            }
        }
        return total;
    };

    const __countPredicateMatchesAcrossRoots = (roots, tag, predicate) => {
        let total = 0;
        const list = Array.isArray(roots) ? roots : [];
        const selector = tag && tag !== '*' ? tag : '*';
        for (let i = 0; i < list.length; i++) {
            const root = list[i];
            if (!root || typeof root.querySelectorAll !== 'function') continue;
            try {
                const matches = root.querySelectorAll(selector);
                for (let j = 0; j < matches.length; j++) {
                    try {
                        if (predicate(matches[j])) {
                            total += 1;
                            if (total > 1) return total;
                        }
                    } catch (_) {
                        continue;
                    }
                }
            } catch (_) {
                continue;
            }
        }
        return total;
    };

    const findElementByFingerprintInRoot = (fingerprint, root, allRoots) => {
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
                // Cross-root twin check (duplicated id / test id across
                // roots): only a globally unique hit may be trusted here.
                // Twins fall through to the descriptor / localPath sections,
                // which carry more identity, or fail safe.
                if (__countSelectorMatchesAcrossRoots(allRoots, selector) !== 1) continue;
                return {
                    element,
                    matchedSelector: selector,
                    strategy: 'fingerprint'
                };
            }
        }

        if (fingerprint.text) {
            const normalizedText = normalizeText(fingerprint.text);
            const textPredicate = (candidate) => {
                const text = normalizeText(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || candidate.getAttribute('title'));
                return text === normalizedText && matchesClassTokens(candidate, fingerprint.classTokens);
            };
            const element = findElementByPredicate(root, tag, textPredicate, fingerprint);

            if (element) {
                if (__countPredicateMatchesAcrossRoots(allRoots, tag, textPredicate) !== 1) {
                    // Same visible text in several roots: keep looking instead
                    // of trusting root order.
                } else {
                    return {
                        element,
                        matchedSelector: 'text:' + normalizedText,
                        strategy: 'fingerprint'
                    };
                }
            }
        }

        const descriptorPredicate = (candidate) => {
            if (fingerprint.role && candidate.getAttribute('role') !== fingerprint.role) return false;
            if (fingerprint.type && candidate.getAttribute('type') !== fingerprint.type) return false;
            if (fingerprint.contentEditable && !(candidate.isContentEditable || candidate.getAttribute('contenteditable') === 'true')) return false;
            if (fingerprint.name && candidate.getAttribute('name') !== fingerprint.name) return false;
            if (fingerprint.placeholder && candidate.getAttribute('placeholder') !== fingerprint.placeholder) return false;
            if (fingerprint.ariaLabel && candidate.getAttribute('aria-label') !== fingerprint.ariaLabel) return false;
            // Identity attributes the old predicate ignored: an element whose
            // id / test id / text disagrees with the saved fingerprint is
            // evidence AGAINST identity, not a neutral mismatch.
            if (fingerprint.safeId && candidate.getAttribute('id') !== fingerprint.safeId) return false;
            if (fingerprint.dataTestId) {
                const tid = candidate.getAttribute('data-testid') || candidate.getAttribute('data-test-id');
                if (tid !== fingerprint.dataTestId) return false;
            }
            if (fingerprint.text) {
                const text = normalizeText(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || candidate.getAttribute('title'));
                if (text !== normalizeText(fingerprint.text)) return false;
            }
            if (!matchesClassTokens(candidate, fingerprint.classTokens)) return false;
            return true;
        };
        const descriptorElement = findElementByPredicate(root, tag, descriptorPredicate, fingerprint);

        if (descriptorElement) {
            if (__countPredicateMatchesAcrossRoots(allRoots, tag, descriptorPredicate) !== 1) {
                // Indistinguishable twins in several roots: keep looking
                // (localPath) or fail safe instead of trusting root order.
            } else {
                return {
                    element: descriptorElement,
                    matchedSelector: 'fingerprint:descriptor',
                    strategy: 'fingerprint'
                };
            }
        }

        if (Array.isArray(fingerprint.localPath) && fingerprint.localPath.length > 0 && typeof root.querySelector === 'function') {
            const localSelector = fingerprint.localPath.join(' > ');
            const element = findUniqueInRoot(root, localSelector);
            if (element) {
                // A structural path that matches in several roots describes
                // twins, not the picked element.
                if (__countSelectorMatchesAcrossRoots(allRoots, localSelector) !== 1) {
                    return null;
                }
                return {
                    element,
                    matchedSelector: localSelector,
                    strategy: 'fingerprint'
                };
            }
        }

        return null;
    };

    const findElementByFingerprint = (fingerprint) => {
        if (!fingerprint || typeof fingerprint !== 'object') {
            return null;
        }

        const primaryRoot = findRootFromHostChain(fingerprint.hostChain);
        const orderedRoots = primaryRoot
            ? uniqueElements([primaryRoot].concat(getSearchRoots()))
            : getSearchRoots();

        for (const root of orderedRoots) {
            const match = findElementByFingerprintInRoot(fingerprint, root, orderedRoots);
            if (match) {
                return match;
            }
        }

        return null;
    };
`
