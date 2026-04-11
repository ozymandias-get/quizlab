import {
  buildCssCandidates,
  buildHostChain,
  buildLocalPath,
  buildSelectorSegment,
  generateLocatorBundle,
  getElementInfo,
  getNthChild,
  getPrimaryAttribute,
  getSafeClassTokens,
  getSafeId,
  getVisibleText,
  inferSendLikeControl,
  normalizeText,
  pushCandidate
} from './dom/pickerDomRuntime'

/**
 * Picker webview script runs in isolation; DOM helpers are emitted as named function sources
 * in dependency order. Implementations live in pickerDomRuntime.ts (single module, no cross-file
 * value imports) so Vitest does not rewrite callees to __vite_ssr_import_* inside .toString().
 *
 * Module-level regex constants in pickerDomRuntime are not part of each function's .toString();
 * mirror them here so injected functions still resolve GENERATED_TOKEN_REGEX / SAFE_CLASS_TOKEN_REGEX.
 */
const INJECTED_DOM_MODULE_PREFIX = [
  '        const GENERATED_TOKEN_REGEX = /(^\\d{5,}$)|([a-z0-9]{15,})|(--)/i;',
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
