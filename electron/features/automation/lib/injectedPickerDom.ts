import {
  buildCssCandidates,
  buildHostChain,
  buildLocalPath,
  buildSelectorSegment,
  cssEscape,
  escapeCssStringValue,
  GENERATED_TOKEN_REGEX,
  generateLocatorBundle,
  getElementInfo,
  getNthChild,
  getPrimaryAttribute,
  getSafeClassTokens,
  getSafeId,
  getVisibleText,
  inferSendLikeControl,
  isElementContentEditable,
  normalizeText,
  pickVerifiedPrimary,
  pushCandidate,
  SAFE_CLASS_TOKEN_REGEX,
  safeMatchesSelector
} from './dom/pickerDomRuntime.js'

/**
 * Picker guest-page script runs in isolation; DOM helpers are emitted as named function sources
 * in dependency order. Implementations live in pickerDomRuntime.ts (single module, no cross-file
 * value imports) so Vitest does not rewrite callees to __vite_ssr_import_* inside .toString().
 *
 * Module-level regex constants in pickerDomRuntime are not part of each function's .toString();
 * they are re-emitted here from the *same exported values*, so the guest page cannot drift from
 * the runtime (a difference here silently changes what counts as a generated class/id).
 */
const INJECTED_DOM_MODULE_PREFIX = [
  `        const GENERATED_TOKEN_REGEX = ${String(GENERATED_TOKEN_REGEX)};`,
  `        const SAFE_CLASS_TOKEN_REGEX = ${String(SAFE_CLASS_TOKEN_REGEX)};`
].join('\n')

export function buildInjectedPickerDomHelpers(): string {
  const parts = [
    getSafeId,
    getNthChild,
    getSafeClassTokens,
    normalizeText,
    getVisibleText,
    pushCandidate,
    getPrimaryAttribute,
    isElementContentEditable,
    cssEscape,
    escapeCssStringValue,
    buildSelectorSegment,
    buildLocalPath,
    buildHostChain,
    buildCssCandidates,
    // Verification helpers must precede generateLocatorBundle: the emitted
    // script defines each helper as a const from fn.toString(), so every
    // name referenced inside generateLocatorBundle has to be emitted.
    safeMatchesSelector,
    pickVerifiedPrimary,
    inferSendLikeControl,
    getElementInfo,
    generateLocatorBundle
  ] as const

  const indent = '        '
  const body = parts.map((fn) => `${indent}const ${fn.name} = ${fn.toString()};`).join('\n')
  return `${INJECTED_DOM_MODULE_PREFIX}\n${body}`
}

/**
 * Minimal subset of the picker DOM helpers needed to re-derive a *stable* CSS
 * selector for an element that the selector engine only found through a
 * fingerprint / semantic / provider recovery.
 *
 * This is what keeps self-healing free of a second selector generator: the
 * exact same `buildCssCandidates` implementation the Magic Selector persists is
 * reused verbatim, so generated-class and id filtering
 * (`GENERATED_TOKEN_REGEX`, `SAFE_CLASS_TOKEN_REGEX`) cannot drift between the
 * manual and the automatic path.
 *
 * Only the transitive callees of `buildCssCandidates` are emitted — including
 * `normalizeText` here would collide with the automation runtime's own
 * `normalizeText` from `baseHelpers`.
 */
export function buildInjectedStableSelectorHelper(): string {
  const parts = [
    getSafeId,
    getSafeClassTokens,
    pushCandidate,
    isElementContentEditable,
    cssEscape,
    escapeCssStringValue,
    buildCssCandidates
  ] as const

  const indent = '    '
  const body = parts.map((fn) => `${indent}const ${fn.name} = ${fn.toString()};`).join('\n')
  return `${INJECTED_DOM_MODULE_PREFIX}\n${body}`
}
