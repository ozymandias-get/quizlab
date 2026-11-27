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
 * Two modes:
 *
 *   - `verify` (default) never touches the page. It reports every candidate and
 *     leaves the decision to the caller, which owns the acceptance rules.
 *   - `probe` is only requested by the caller when the normal verification
 *     failed on a send button and the composer is empty (ChatGPT renders voice
 *     mode until text is typed). It writes a single non-submitted character,
 *     observes the newly rendered candidates, and removes the character again.
 *     The probe never submits, never clears a draft and never removes anything
 *     it cannot prove it wrote.
 *
 * The probe is a separate run, not a retry inside the verify run: the caller
 * evaluates the probe's attempts with the same `verifyPick` rules and never
 * merges attempts from the two DOM states.
 */
import type { AutomationConfig, AutomationElementFingerprint } from '@shared-core/types'

import { serializeAutomationConfig } from '../../scripts/config.js'
import { createScriptPreamble } from '../preamble.js'

interface VerifyLocatorInput {
  field: 'input' | 'button'
  /** The picked primary first, then the other candidates. */
  selectors: string[]
  fingerprint: AutomationElementFingerprint | null
  /** Optional input locator used when verifying a send button on an empty composer. */
  composerInput?: {
    selectors: string[]
    fingerprint: AutomationElementFingerprint | null
  } | null
  /** `true` runs the empty-composer probe instead of a read-only verification. */
  probe?: boolean
}

const generateVerifyLocatorScript = (input: VerifyLocatorInput): string => {
  const isInput = input.field === 'input'
  const isProbe = input.probe === true && !isInput
  const composerSelectors =
    !isInput && input.composerInput
      ? input.composerInput.selectors
          .map((selector) => selector.trim())
          .filter((selector) => selector.length > 0)
      : []

  const config: AutomationConfig = {
    version: 2,
    submitMode: 'mixed',
    input: isInput ? (input.selectors[0] ?? null) : (composerSelectors[0] ?? null),
    inputCandidates: isInput
      ? input.selectors
      : composerSelectors.length > 0
        ? composerSelectors
        : null,
    inputFingerprint: isInput ? input.fingerprint : (input.composerInput?.fingerprint ?? null),
    button: isInput ? null : (input.selectors[0] ?? null),
    buttonCandidates: isInput ? null : input.selectors,
    buttonFingerprint: isInput ? null : input.fingerprint
  }
  const serialized = serializeAutomationConfig(config)
  const lookup = isInput ? 'config.input' : 'config.button'
  const selectors = input.selectors
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0)

  const writeHelpers = isProbe
    ? `
            const readComposerText = (element) => {
                if (!element) return '';
                const tag = (element.tagName || '').toLowerCase();
                if (tag === 'textarea' || tag === 'input') {
                    return String(element.value || '');
                }
                return String(element.innerText || element.textContent || '');
            };

            // A contenteditable composer reports a structural newline (or a
            // <p><br></p> paragraph) when it is empty. Only *visible* characters
            // count as a draft, so a real whitespace-only draft still blocks the
            // probe instead of being overwritten.
            const normalizeComposerText = (element) => {
                const text = readComposerText(element);
                const tag = (element && element.tagName || '').toLowerCase();
                if (tag === 'textarea' || tag === 'input') return text;
                return text.replace(/[\\n\\r\\u200b]/g, '');
            };

            const hasMeaningfulComposerContent = (element) => {
                try {
                    if (element.querySelector('img, figure, picture, video, audio, a[href]')) {
                        return true;
                    }
                    if (element.querySelector('[data-mention], [data-testid="mention"]')) return true;
                    const nestedEditable = element.querySelector('[contenteditable="true"], textarea, input');
                    if (nestedEditable && nestedEditable !== element) return true;
                } catch (_) {}
                return false;
            };

            const isComposerEmpty = (element) => {
                if (!element) return false;
                return (
                    normalizeComposerText(element).length === 0 &&
                    !hasMeaningfulComposerContent(element)
                );
            };

            const resolveComposerInput = () => {
                const inputCfg = config.input;
                if (!inputCfg) return null;
                const expectedTag = String(inputCfg.fingerprint?.tag || '').toLowerCase();
                const accept = (element) => {
                    if (!element || !element.isConnected) return null;
                    const tag = (element.tagName || '').toLowerCase();
                    const isEntry =
                        tag === 'textarea' ||
                        tag === 'input' ||
                        element.isContentEditable === true ||
                        element.getAttribute('contenteditable') === 'true';
                    if (!isEntry) return null;
                    // Writing into the wrong editor is worse than not probing.
                    if (expectedTag && tag !== expectedTag) return null;
                    return element;
                };
                const inputSelectors = Array.isArray(inputCfg.selectors) ? inputCfg.selectors : [];
                for (const sel of inputSelectors) {
                    try {
                        const match = findUniqueSelectorMatch(sel, inputCfg.fingerprint);
                        const accepted = accept(match && match.element);
                        if (accepted) return accepted;
                    } catch (_) {}
                }
                if (inputCfg.fingerprint) {
                    try {
                        const fpMatch = findElementByFingerprint(inputCfg.fingerprint);
                        const accepted = accept(fpMatch && fpMatch.element);
                        if (accepted) return accepted;
                    } catch (_) {}
                }
                return null;
            };

            const resolveNativeValueSetter = (element) => {
                const proto = Object.getPrototypeOf(element);
                return (
                    (proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set) ||
                    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement?.prototype || {}, 'value')?.set ||
                    Object.getOwnPropertyDescriptor(window.HTMLInputElement?.prototype || {}, 'value')?.set ||
                    null
                );
            };

            const writeProbeText = (element, text) => {
                const isEditable = Boolean(
                    element.isContentEditable || element.getAttribute('contenteditable') === 'true'
                );
                if (typeof element.focus === 'function') element.focus();
                if (!isEditable) {
                    const setter = resolveNativeValueSetter(element);
                    if (setter) setter.call(element, text);
                    else element.value = text;
                    try {
                        element.dispatchEvent(new InputEvent('input', {
                            bubbles: true,
                            composed: true,
                            inputType: text ? 'insertText' : 'deleteContentBackward',
                            data: text || null
                        }));
                    } catch (_) {
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
                try {
                    const sel = window.getSelection ? window.getSelection() : null;
                    if (sel && typeof document.createRange === 'function') {
                        const range = document.createRange();
                        range.selectNodeContents(element);
                        if (text) range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                } catch (_) {}
                let applied = false;
                if (typeof document.execCommand === 'function') {
                    try {
                        applied = text
                            ? Boolean(document.execCommand('insertText', false, text))
                            : Boolean(document.execCommand('delete', false, null));
                    } catch (_) {
                        applied = false;
                    }
                }
                if (!applied || (text === '' && readComposerText(element).replace(/[\\s\\n\\r\\u200b]/g, '').length > 0)) {
                    try {
                        element.textContent = text;
                        element.dispatchEvent(new InputEvent('input', {
                            bubbles: true,
                            composed: true,
                            inputType: text ? 'insertText' : 'deleteContentBackward',
                            data: text || null
                        }));
                    } catch (_) {}
                }
            };
`
    : ''

  const body = isProbe
    ? `
            // Probe run: one character, one observation window, owned cleanup.
            const composerEl = resolveComposerInput();
            if (!composerEl) {
                return {
                    success: false,
                    action: 'probe_composer',
                    field: '${input.field}',
                    href: String(location.href || ''),
                    attempts: [],
                    composerState: 'no_input',
                    probe: 'not_run'
                };
            }
            if (!isComposerEmpty(composerEl)) {
                return {
                    success: false,
                    action: 'probe_composer',
                    field: '${input.field}',
                    href: String(location.href || ''),
                    attempts: [],
                    composerState: 'non_empty',
                    probe: 'not_run'
                };
            }

            const prevActive = document.activeElement;
            const probeText = '.';
            let attempts = [];
            let probeState = 'empty_probe_no_button';
            try {
                writeProbeText(composerEl, probeText);
                // Keep observing for the whole window instead of accepting the
                // first element that appears: the first render during hydration
                // can still be a twin (voice/mic) before the send button swaps in.
                const probeDeadline = Date.now() + 1200;
                while (Date.now() < probeDeadline) {
                    const collected = collect();
                    if (collected.length > 0) attempts = collected;
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                probeState = attempts.length > 0 ? 'empty_probed' : 'empty_probe_no_button';
            } finally {
                // Ownership-safe cleanup: remove the character only when the
                // same live element still holds exactly our probe. A composer
                // that was re-created, a draft the user started typing, or any
                // other unexpected content is left untouched.
                try {
                    if (composerEl.isConnected && normalizeComposerText(composerEl) === probeText) {
                        writeProbeText(composerEl, '');
                    }
                } catch (_) {}
                try {
                    // Never steal focus the user has already moved elsewhere.
                    if (document.activeElement === composerEl) {
                        if (prevActive && prevActive !== composerEl && typeof prevActive.focus === 'function') {
                            prevActive.focus();
                        } else if (typeof composerEl.blur === 'function') {
                            composerEl.blur();
                        }
                    }
                } catch (_) {}
            }

            return {
                success: attempts.length > 0,
                action: 'probe_composer',
                field: '${input.field}',
                href: String(location.href || ''),
                attempts,
                composerState: probeState,
                probe: 'ran',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    attempts.length > 0 ? null : '${input.field}_not_found'
                )
            };
`
    : `
            // The app view may still be loading when the pick arrives. Retrying
            // only while *nothing* resolved keeps the normal path at one pass.
            const initialWaitMs = ${!isInput && composerSelectors.length > 0 ? 1200 : 2500};
            const deadline = Date.now() + initialWaitMs;
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
                composerState: 'not_checked',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    found ? null : '${input.field}_not_found'
                )
            };
`

  return `
    ${createScriptPreamble('validate', serialized, true)}
        try {
            const isElementVisible = (element) => {
                if (!element || !element.isConnected) return false;
                try {
                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    const rect = element.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                } catch (_) {
                    return false;
                }
            };

            const describeElement = (element) => ({
                tag: (element.tagName || '').toLowerCase(),
                role: element.getAttribute('role'),
                type: element.getAttribute('type'),
                id: element.getAttribute('id'),
                dataTestId: element.getAttribute('data-testid') || element.getAttribute('data-test-id'),
                ariaLabel: element.getAttribute('aria-label'),
                placeholder: element.getAttribute('placeholder'),
                title: element.getAttribute('title'),
                name: element.getAttribute('name'),
                dataComposerSubmit: element.hasAttribute('data-composer-submit'),
                hasDictationAttr:
                    element.hasAttribute('data-start-dictation') ||
                    element.hasAttribute('data-cancel-dictation') ||
                    element.hasAttribute('data-submit-dictation'),
                visible: isElementVisible(element),
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
${writeHelpers}${body}
        } catch (error) {
            return {
                success: false,
                action: '${isProbe ? 'probe_composer' : 'verify_locator'}',
                field: '${input.field}',
                error: error instanceof Error ? error.message : '${isProbe ? 'probe_failed' : 'verify_failed'}'
            };
        }
    })();
    `
}

export { generateVerifyLocatorScript }
