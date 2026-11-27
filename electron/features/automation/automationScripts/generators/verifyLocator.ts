/**
 * Verifies one picked locator inside the app's own managed view.
 *
 * The Chrome picker produces a selector from a *Chrome* DOM. The app can only
 * accept it after the same selector resolves the intended element inside the
 * Electron view, so this generator reuses the existing lookup pipeline rather
 * than trusting `querySelector() !== null`:
 *
 *   - `findUniqueSelectorMatch` requires a unique match that agrees with the
 *     fingerprint (tag, role, type, editable, id, test id, text, classes);
 *   - the caller compares the reported `matchedSelector` with the candidates
 *     that were sent, so a selector that silently resolved to a twin is
 *     rejected instead of stored.
 *
 * The script is the same validate pipeline with a single field, so no second
 * selector engine exists.
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
  const diagnosticsField = isInput ? 'diagnostics.input' : 'diagnostics.button'
  const mustBeInteractive = isInput ? 'false' : 'true'

  return `
    ${createScriptPreamble('validate', serialized, true)}
        try {
            const result = await waitForElement(${lookup}, '${input.field}', ${diagnosticsField}, config, 2500, ${mustBeInteractive});
            const found = Boolean(result && result.element);
            const element = found && result ? result.element : null;
            // The Chrome DOM and the Electron DOM are not the same document.
            // A selector that happens to match exactly one *other* element here
            // would still look "found"; the descriptor is what lets the caller
            // compare the element it picked in Chrome with the one this
            // document resolved, field by field.
            const descriptor = element ? {
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
                text: String(
                    element.innerText || element.textContent || ''
                ).replace(/\\s+/g, ' ').trim().slice(0, 256)
            } : null;
            return {
                success: found,
                action: 'verify_locator',
                field: '${input.field}',
                matchedSelector: found && result ? (result.matchedSelector || null) : null,
                strategy: found && result ? result.strategy : 'none',
                descriptor,
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
