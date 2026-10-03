/**
 * The gate a selector must pass before it is allowed anywhere near disk, plus
 * the config keys a promotion rewrites.
 *
 * Single source of truth for both directions of the loop: the runtime uses it
 * to decide whether to report a `stableSelector` at all, the renderer uses it
 * when promoting, and the electron sanitizer re-checks it before a payload is
 * written.
 */
import type { SelectorRepairKind } from '../types/automation.js'

/**
 * Prefix markers the runtime uses for non-CSS selector identities
 * (`fingerprint:descriptor`, `semantic:auto`, `gemini:composer-fallback`, …).
 * Persisting any of these as a CSS selector would break the config, so they are
 * rejected before a repair candidate can ever reach disk.
 */
const INTERNAL_SELECTOR_MARKER =
  /^(?:fingerprint|text|semantic|provider|siteStrategy|heuristic|gemini|chatgpt|generic|builtin|config|__)[a-zA-Z]*:/i

/**
 * Characters that can never appear in a selector produced by
 * `buildCssCandidates` and would indicate code smuggling rather than a selector.
 * Attribute selectors (`[aria-label="Send"]`) are legal and explicitly allowed.
 */
const UNSAFE_SELECTOR_CHARS = /[{};<>\\`\n\r]/

/** True when a matched selector is a runtime marker rather than a CSS selector. */
export function isInternalMarkerSelector(selector: unknown): boolean {
  if (typeof selector !== 'string') return false
  const trimmed = selector.trim()
  if (!trimmed) return true
  return INTERNAL_SELECTOR_MARKER.test(trimmed)
}

/**
 * A selector may only be persisted when it is a plain, non-generated CSS
 * selector of bounded length. This is the single gate used by both the runtime
 * (`stableSelector` computation) and the renderer (promotion), and the electron
 * sanitizer re-checks it before anything reaches disk.
 */
export function isPersistableSelector(selector: unknown, maxLength = 2000): boolean {
  if (typeof selector !== 'string') return false
  const trimmed = selector.trim()
  if (!trimmed || trimmed.length > maxLength) return false
  if (isInternalMarkerSelector(trimmed)) return false
  return !UNSAFE_SELECTOR_CHARS.test(trimmed)
}

/** The selector keys a promotion rewrites, per locator kind. */
export function getLocatorSelectorKeys(kind: SelectorRepairKind): {
  primary: 'input' | 'button'
  candidates: 'inputCandidates' | 'buttonCandidates'
} {
  return kind === 'input'
    ? { primary: 'input', candidates: 'inputCandidates' }
    : { primary: 'button', candidates: 'buttonCandidates' }
}
