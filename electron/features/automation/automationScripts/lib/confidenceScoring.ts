export const confidenceScoring = `    const CONFIDENCE_THRESHOLD_HIGH = 70;
    const CONFIDENCE_THRESHOLD_MEDIUM = 40;

    const computeConfidenceScore = (candidate, kind, config) => {
        if (!candidate || !candidate.element) return { score: 0, level: 'low' };

        const el = candidate.element;
        let score = 0;

        const role = (el.getAttribute && el.getAttribute('role')) || '';
        const ariaLabel = (el.getAttribute && el.getAttribute('aria-label')) || '';
        const placeholder = (el.getAttribute && el.getAttribute('placeholder')) || '';
        const type = (el.getAttribute && el.getAttribute('type')) || '';
        const tag = (el.tagName || '').toLowerCase();
        const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

        const selectors = uniqueStrings(kind === 'input' ? config.input.selectors : config.button.selectors);
        const primarySelector = selectors[0] || '';

        // Fingerprint-based scoring: if the element matches the saved
        // fingerprint's key attributes, give a strong boost. This is the
        // most reliable signal for picking the RIGHT element when multiple
        // candidates share the same selector or semantic pattern.
        const fingerprint = kind === 'input' ? (config.input && config.input.fingerprint) : (config.button && config.button.fingerprint);
        if (fingerprint && el) {
            const elAriaLabel = (el.getAttribute && el.getAttribute('aria-label')) || '';
            if (fingerprint.ariaLabel && elAriaLabel && elAriaLabel.toLowerCase() === fingerprint.ariaLabel.toLowerCase()) {
                score += 50;
            }

            const elText = (el.innerText || el.textContent || '').trim();
            if (fingerprint.text && elText && elText.toLowerCase() === fingerprint.text.toLowerCase()) {
                score += 45;
            }

            const elTestId = (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test-id'))) || '';
            if (fingerprint.dataTestId && elTestId && elTestId === fingerprint.dataTestId) {
                score += 40;
            }

            const elName = (el.getAttribute && el.getAttribute('name')) || '';
            if (fingerprint.name && elName && elName === fingerprint.name) {
                score += 35;
            }

            const elPh = (el.getAttribute && el.getAttribute('placeholder')) || '';
            if (fingerprint.placeholder && elPh && elPh === fingerprint.placeholder) {
                score += 35;
            }

            if (fingerprint.classTokens && fingerprint.classTokens.length > 0 && el.classList) {
                const matchingTokens = fingerprint.classTokens.filter((t) => el.classList.contains(t));
                score += matchingTokens.length * 10;
            }
        }

        if (kind === 'button') {
            const sendPatterns = ['send', 'gönder', 'gonder', 'submit', 'reply'];
            const ariaLower = ariaLabel.toLowerCase();
            const hasSendPattern = sendPatterns.some(p => ariaLower.includes(p));
            if (hasSendPattern) score += 30;

            const title = (el.getAttribute('title') || '').toLowerCase();
            if (sendPatterns.some(p => title.includes(p))) score += 20;

            const testId = (el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '').toLowerCase();
            if (sendPatterns.some(p => testId.includes(p))) score += 25;

            if (role === 'button' || tag === 'button' || tag === 'input' && type === 'submit') score += 20;

            if (candidate.matchedSelector && primarySelector && candidate.matchedSelector === primarySelector) score += 15;
        } else {
            const inputPatterns = ['message', 'ask', 'prompt', 'type', 'yaz', 'sor'];
            const ariaLower = ariaLabel.toLowerCase();
            const placeholderLower = placeholder.toLowerCase();
            const hasInputPattern = inputPatterns.some(p => ariaLower.includes(p) || placeholderLower.includes(p));
            if (hasInputPattern) score += 30;

            if (role === 'textbox') score += 20;

            if (isContentEditable) score += 10;

            if (tag === 'textarea' || (tag === 'input' && (type === 'text' || type === 'search' || !type))) score += 15;

            if (candidate.matchedSelector && primarySelector && candidate.matchedSelector === primarySelector) score += 15;
        }

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        if (isVisible) score += 10;

        const isInteractive = !el.disabled && el.getAttribute('disabled') === null && el.getAttribute('aria-disabled') !== 'true';
        if (isInteractive) score += 5;

        const cache = getAutomationCache();
        const lookupKey = getLookupCacheKey(kind === 'input' ? config.input : config.button);
        const cacheKey = kind + '::' + lookupKey;
        if (cache.elements[cacheKey] && cache.elements[cacheKey].element === el) score += 10;

        let level = 'low';
        if (score >= CONFIDENCE_THRESHOLD_HIGH) level = 'high';
        else if (score >= CONFIDENCE_THRESHOLD_MEDIUM) level = 'medium';

        return { score, level };
    };
\n`
