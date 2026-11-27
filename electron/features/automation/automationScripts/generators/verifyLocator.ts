/**
 * Verifies one picked locator inside the app's own managed view.
 *
 * The Chrome picker produces a selector from a *Chrome* DOM. The app can only
 * accept it after the same selector resolves the intended element inside the
 * Electron view, so this generator reuses the existing lookup pipeline rather
 * than trusting `querySelector() !== null`:
 *
 *   - every candidate is resolved on its own and reported with the element it
 *     produced, so the caller can choose the candidate that agrees with the
 *     fingerprint instead of the first candidate that happened to match;
 *   - the caller compares the reported descriptor with the fingerprint the pick
 *     carried, so a selector that resolved to a twin is rejected.
 *
 * Resolving every candidate matters: on ChatGPT the send button and the voice
 * button share the composer class list. The class candidate therefore resolves
 * to whichever of the two the engine prefers first, while the generic `button`
 * candidate still finds the send button by its fingerprint. Stopping at the
 * first candidate made a correct pick look like an identity mismatch.
 */
import type { AutomationConfig, AutomationElementFingerprint } from '@shared-core/types'

import { serializeAutomationConfig } from '../../scripts/config.js'
import { createScriptPreamble } from '../preamble.js'

interface VerifyLocatorInput {
  field: 'input' | 'button'
  /** The picked primary first, then the other candidates. */
  selectors: string[]
  fingerprint: AutomationElementFingerprint | null
}

const generateVerifyLocatorScript = (input: VerifyLocatorInput): string => {
  const isInput = input.field === 'input'
  const config: AutomationConfig = {
    version: 2,
    submitMode: 'mixed',
    input: isInput ? (input.selectors[0] ?? null) : null,
    inputCandidates: isInput ? input.selectors : null,
    inputFingerprint: isInput ? input.fingerprint : null,
    button: isInput ? null : (input.selectors[0] ?? null),
    buttonCandidates: isInput ? null : input.selectors,
    buttonFingerprint: isInput ? null : input.fingerprint
  }
  const serialized = serializeAutomationConfig(config)
  const lookup = isInput ? 'config.input' : 'config.button'
  const selectors = input.selectors
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0)

  return `
    ${createScriptPreamble('validate', serialized, true)}
        try {
            const describeElement = (element) => ({
                tag: (element.tagName || '').toLowerCase(),
                role: element.getAttribute('role'),
                type: element.getAttribute('type'),
                id: element.getAttribute('id'),
                dataTestId: element.getAttribute('data-testid') || element.getAttribute('data-test-id'),
                ariaLabel: element.getAttribute('aria-label'),
                placeholder: element.getAttribute('placeholder'),
                name: element.getAttribute('name'),
                contentEditable: Boolean(
                    element.isContentEditable || element.getAttribute('contenteditable') === 'true'
                ),
                classTokens: Array.from(element.classList || []).slice(0, 12),
                text: String(
                    element.innerText || element.textContent || ''
                ).replace(/\\s+/g, ' ').trim().slice(0, 256)
            });

            const fingerprint = ${lookup} && ${lookup}.fingerprint;
            const candidates = ${JSON.stringify(selectors)};
            const elementKeys = new WeakMap();
            let nextElementKey = 1;
            const elementKeyOf = (element) => {
                let key = elementKeys.get(element);
                if (!key) {
                    key = nextElementKey++;
                    elementKeys.set(element, key);
                }
                return key;
            };

            const collect = () => {
                const attempts = [];
                const seen = new Set();
                for (const selector of candidates) {
                    if (seen.has(selector)) continue;
                    seen.add(selector);
                    let match = null;
                    try {
                        match = findUniqueSelectorMatch(selector, fingerprint);
                    } catch (_) {
                        match = null;
                    }
                    if (!match || !match.element) continue;
                    attempts.push({
                        selector,
                        matchedSelector: match.matchedSelector || selector,
                        strategy: match.strategy || 'none',
                        elementKey: elementKeyOf(match.element),
                        descriptor: describeElement(match.element)
                    });
                }
                return attempts;
            };

            // The app view may still be loading when the pick arrives. Retrying
            // only while *nothing* resolved keeps the normal path at one pass.
            const deadline = Date.now() + 2500;
            let attempts = [];
            while (Date.now() < deadline) {
                attempts = collect();
                if (attempts.length > 0) break;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const first = attempts[0] || null;
            const found = attempts.length > 0;
            return {
                success: found,
                action: 'verify_locator',
                field: '${input.field}',
                href: String(location.href || ''),
                matchedSelector: first ? first.matchedSelector : null,
                strategy: first ? first.strategy : 'none',
                descriptor: first ? first.descriptor : null,
                attempts,
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    found ? null : '${input.field}_not_found'
                )
            };
        } catch (error) {
            return {
                success: false,
                action: 'verify_locator',
                field: '${input.field}',
                error: error instanceof Error ? error.message : 'verify_failed'
            };
        }
    })();
    `
}

export { generateVerifyLocatorScript }
