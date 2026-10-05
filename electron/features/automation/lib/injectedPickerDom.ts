import {
  buildCssCandidates,
  buildHostChain,
  buildLocalPath,
  buildSelectorSegment,
  cssEscape,
  escapeCssStringValue,
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
  pushCandidate
} from './dom/pickerDomRuntime.js'

/**
 * Picker guest-page script runs in isolation; DOM helpers are emitted as named function sources
 * in dependency order. Implementations live in pickerDomRuntime.ts (single module, no cross-file
 * value imports) so Vitest does not rewrite callees to __vite_ssr_import_* inside .toString().
 *
 * Module-level regex constants in pickerDomRuntime are not part of each function's .toString();
 * mirror them here so injected functions still resolve GENERATED_TOKEN_REGEX / SAFE_CLASS_TOKEN_REGEX.
 */
const INJECTED_DOM_MODULE_PREFIX = [
  '        const GENERATED_TOKEN_REGEX = /(^--)|(^\\d{5,}$)|([a-z0-9]{15,})|([a-z]+[-_]\\d{5,}$)/i;',
  '        const SAFE_CLASS_TOKEN_REGEX = /^[a-zA-Z][\\w-]{0,63}$/;'
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
