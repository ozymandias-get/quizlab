export const fingerprintSearchHelpers = `    const findElementByFingerprintInRoot = (fingerprint, root) => {
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

    const findElementByFingerprint = (fingerprint) => {
        if (!fingerprint || typeof fingerprint !== 'object') {
            return null;
        }

        const primaryRoot = findRootFromHostChain(fingerprint.hostChain);
        const orderedRoots = primaryRoot
            ? uniqueElements([primaryRoot].concat(getSearchRoots()))
            : getSearchRoots();

        for (const root of orderedRoots) {
            const match = findElementByFingerprintInRoot(fingerprint, root);
            if (match) {
                return match;
            }
        }

        return null;
    };
`
