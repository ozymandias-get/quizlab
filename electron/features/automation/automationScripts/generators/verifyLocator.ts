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
 * When verifying a send button that is not yet rendered in Electron because the
 * composer is empty (e.g. ChatGPT shows voice mode until text is typed), and
 * the composer input is confirmed empty, the verifier can safely probe with a
 * single non-submitted character and immediately restore the empty state in a
 * `finally` block. Non-empty user drafts are never touched.
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
}

const generateVerifyLocatorScript = (input: VerifyLocatorInput): string => {
  const isInput = input.field === 'input'
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

            const readComposerText = (element) => {
                if (!element) return '';
                const tag = (element.tagName || '').toLowerCase();
                if (tag === 'textarea' || tag === 'input') {
                    return String(element.value || '');
                }
                return String(element.innerText || element.textContent || '');
            };

            const resolveComposerInput = () => {
                const inputCfg = config.input;
                if (!inputCfg) return null;
                const inputSelectors = Array.isArray(inputCfg.selectors) ? inputCfg.selectors : [];
                for (const sel of inputSelectors) {
                    try {
                        const match = findUniqueSelectorMatch(sel, inputCfg.fingerprint);
                        if (match && match.element && match.element.isConnected) return match.element;
                    } catch (_) {}
                }
                if (inputCfg.fingerprint) {
                    try {
                        const fpMatch = findElementByFingerprint(inputCfg.fingerprint);
                        if (fpMatch && fpMatch.element && fpMatch.element.isConnected) return fpMatch.element;
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
                if (!applied || (text === '' && readComposerText(element).trim().length > 0)) {
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

            let composerState = 'not_checked';
            if (!${isInput} && attempts.length === 0) {
                const composerEl = resolveComposerInput();
                if (composerEl) {
                    const existingText = readComposerText(composerEl);
                    if (existingText.trim().length > 0) {
                        composerState = 'non_empty';
                    } else {
                        composerState = 'empty';
                        const prevActive = document.activeElement;
                        try {
                            writeProbeText(composerEl, '.');
                            const probeDeadline = Date.now() + 1200;
                            while (Date.now() < probeDeadline) {
                                attempts = collect();
                                if (attempts.length > 0) break;
                                await new Promise((resolve) => setTimeout(resolve, 100));
                            }
                            composerState = attempts.length > 0 ? 'empty_probed' : 'empty_probe_no_button';
                        } finally {
                            // Always restore the empty composer state without ever submitting.
                            writeProbeText(composerEl, '');
                            try {
                                if (prevActive && prevActive !== composerEl && typeof prevActive.focus === 'function') {
                                    prevActive.focus();
                                } else if (typeof composerEl.blur === 'function') {
                                    composerEl.blur();
                                }
                            } catch (_) {}
                        }
                    }
                } else {
                    const fallbackEditors = Array.from(
                        document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')
                    ).filter(isElementVisible);
                    if (fallbackEditors.length > 0) {
                        const anyEmpty = fallbackEditors.some((ed) => readComposerText(ed).trim().length === 0);
                        composerState = anyEmpty ? 'empty_unknown_input' : 'non_empty_unknown_input';
                    } else {
                        composerState = 'no_input';
                    }
                }
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
                composerState,
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
