/* eslint-disable no-restricted-globals -- selector engine is DOM-dependent by design, shared between Electron and renderer */
/**
 * Unified selector engine — single source of truth for both Electron
 * automation (webview injection) and Renderer Settings UI (selector validation).
 *
 * Previously the CSS selector cleaning, XPath, :has()/aria-label handling and
 * confidence-scoring logic existed in two copies:
 *  - electron/features/automation/automationScripts/lib/domSearchHelpers.ts
 *  - src/features/settings/ui/selectors/selectorUtils.ts
 * A fix on one side never reached the other, causing "Seçiciyi Doğrula" to
 * succeed while the real automation failed. This module is the canonical
 * implementation; both sides must import from here.
 */

/** Priority table — higher = more stable. The highest-priority selector is cached. */
export const SELECTOR_PRIORITY = Object.freeze({
  id: 100,
  dataTestId: 90,
  ariaLabel: 75,
  role: 65,
  name: 60,
  placeholder: 50,
  type: 45,
  contentEditable: 40,
  tagClass: 25,
  tagNth: 10,
  fingerprint: 110,
  fallback: 0
} as const)

export type SelectorCategory = keyof typeof SELECTOR_PRIORITY

/**
 * Escapes a string for use inside a CSS attribute value selector ("...").
 * Unlike CSS.escape (identifier escaping), this applies CSS string escaping
 * rules: backslash and double-quote must be escaped with a backslash.
 * Shared between domSearchHelpers (__escapeCssStr) and settings UI.
 */
export function escapeCssString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

/**
 * Normalizes a raw selector string: trims, removes redundant whitespace,
 * and strips unsupported pseudo-classes that would make querySelector throw.
 * Handles :has() by stripping it for environments that don't support it
 * (the fallback pipeline will handle the semantic search).
 */
export function normalizeSelector(selector: string): string {
  let s = String(selector || '').trim()
  if (!s) return ''
  // Collapse whitespace
  s = s.replaceAll(/\s+/g, ' ')
  // Remove :has() wrapper with balanced parentheses — handles nested like :has(div:not(.a))
  s = stripHasPseudo(s)
  return s.trim()
}

function stripHasPseudo(input: string): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const idx = input.indexOf(':has(', i)
    if (idx === -1) {
      out += input.slice(i)
      break
    }
    out += input.slice(i, idx)
    let depth = 1
    let j = idx + 5 // after ':has('
    while (j < input.length && depth > 0) {
      const ch = input[j]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      j++
    }
    // If unmatched, drop rest (invalid selector) and break
    if (depth !== 0) break
    i = j
  }
  return out
}

/**
 * Returns true if the selector can be parsed by the current engine
 * without throwing. Uses a try/catch around querySelector on a detached
 * element so CSP / DOM state cannot affect the result.
 */
export function isSelectorValid(selector: string): boolean {
  const s = normalizeSelector(selector)
  if (!s) return false
  try {
    document.createDocumentFragment().querySelector(s)
    return true
  } catch {
    return false
  }
}

/**
 * Classifies a selector string into a category for priority ordering.
 * Must stay in sync with the injected template's __classifySelector.
 */
export function classifySelector(selector: string): SelectorCategory {
  const s = String(selector || '').trim()
  if (!s) return 'fallback'
  if (/^#[a-zA-Z][\w-]*$/.test(s)) return 'id'
  if (/\[(?:data-testid|data-test-id)\s*=/.test(s)) return 'dataTestId'
  if (/\[aria-label\s*=/.test(s)) return 'ariaLabel'
  if (/\[role\s*=/.test(s)) return 'role'
  if (/\[name\s*=/.test(s)) return 'name'
  if (/\[placeholder\s*=/.test(s)) return 'placeholder'
  if (/\[type\s*=/.test(s)) return 'type'
  if (/\[contenteditable/.test(s)) return 'contentEditable'
  if (/^\w+\.[\w.-]+/.test(s) || /^\w+\[class\*=/.test(s)) return 'tagClass'
  if (/:nth-child\(/.test(s)) return 'tagNth'
  if (/^fingerprint:/.test(s)) return 'fingerprint'
  return 'fallback'
}

export function getSelectorPriority(selector: string): number {
  return SELECTOR_PRIORITY[classifySelector(selector)] ?? 0
}

/**
 * Sorts selectors by priority descending, then alphabetically for stability.
 * Deduplicates via Set. Mirrors __sortSelectorsByPriority in the injected script.
 */
export function sortSelectorsByPriority(selectors: string[]): string[] {
  const list = [...new Set((selectors || []).filter(Boolean) as string[])]
  return [...list].sort((a, b) => {
    const pa = getSelectorPriority(a)
    const pb = getSelectorPriority(b)
    if (pa !== pb) return pb - pa
    return a < b ? -1 : a > b ? 1 : 0
  })
}

/**
 * Confidence scoring — shared between the injected automation (confidenceScoring.ts)
 * and the Settings UI validation. Higher score = better match for the intended
 * element when a selector matches multiple candidates.
 */
export interface Fingerprint {
  ariaLabel?: string
  text?: string
  dataTestId?: string
  name?: string
  placeholder?: string
  role?: string
  classTokens?: string[]
}

export function fingerprintMatchScore(element: Element, fingerprint?: Fingerprint | null): number {
  if (!fingerprint || !element) return 0
  if ((element as unknown as { nodeType?: number }).nodeType !== 1) return 0
  if ((element as unknown as { isConnected?: boolean }).isConnected === false) return 0
  let score = 0
  const al = (element.getAttribute?.('aria-label') || '').toLowerCase()
  if (fingerprint.ariaLabel && al && al === fingerprint.ariaLabel.toLowerCase()) score += 40
  const text = ((element as HTMLElement).innerText || element.textContent || '')
    .trim()
    .toLowerCase()
  if (fingerprint.text && text && text === fingerprint.text.toLowerCase()) score += 35
  const tid = (
    element.getAttribute?.('data-testid') ||
    element.getAttribute?.('data-test-id') ||
    ''
  ).toLowerCase()
  if (fingerprint.dataTestId && tid && tid.toLowerCase() === fingerprint.dataTestId.toLowerCase())
    score += 30
  const name = (element.getAttribute?.('name') || '').toLowerCase()
  if (fingerprint.name && name && name === fingerprint.name.toLowerCase()) score += 25
  const ph = (element.getAttribute?.('placeholder') || '').toLowerCase()
  if (fingerprint.placeholder && ph && ph === fingerprint.placeholder.toLowerCase()) score += 25
  const role = (element.getAttribute?.('role') || '').toLowerCase()
  if (fingerprint.role && role && role === fingerprint.role.toLowerCase()) score += 10
  if (fingerprint.classTokens?.length && (element as HTMLElement).classList) {
    const matching = fingerprint.classTokens.filter((t) =>
      (element as HTMLElement).classList.contains(t)
    )
    score += matching.length * 5
  }
  return score
}

export interface ConfidenceCandidate {
  element: Element
  matchedSelector?: string | null
  strategy?: string
}

export function computeConfidenceScore(
  candidate: ConfidenceCandidate | null,
  kind: 'input' | 'button',
  config: {
    input: { selectors?: string[]; fingerprint?: Fingerprint | null }
    button: { selectors?: string[]; fingerprint?: Fingerprint | null }
  }
): { score: number; level: 'high' | 'medium' | 'low' } {
  const CONFIDENCE_THRESHOLD_HIGH = 70
  const CONFIDENCE_THRESHOLD_MEDIUM = 40
  if (!candidate?.element) return { score: 0, level: 'low' }
  const el = candidate.element as HTMLElement
  let score = 0
  const role = (el.getAttribute?.('role') || '').toLowerCase()
  const ariaLabel = (el.getAttribute?.('aria-label') || '').toLowerCase()
  const placeholder = (el.getAttribute?.('placeholder') || '').toLowerCase()
  const type = (el.getAttribute?.('type') || '').toLowerCase()
  const tag = (el.tagName || '').toLowerCase()
  const isContentEditable =
    (el as unknown as { isContentEditable?: boolean }).isContentEditable ||
    el.getAttribute?.('contenteditable') === 'true'
  const selectors = kind === 'input' ? config.input.selectors || [] : config.button.selectors || []
  const primarySelector = selectors[0] || ''
  const fingerprint = kind === 'input' ? config.input.fingerprint : config.button.fingerprint
  if (fingerprint) {
    const elAriaLabel = (el.getAttribute?.('aria-label') || '').toLowerCase()
    if (fingerprint.ariaLabel && elAriaLabel && elAriaLabel === fingerprint.ariaLabel.toLowerCase())
      score += 50
    const elText = ((el as HTMLElement).innerText || el.textContent || '').trim().toLowerCase()
    if (fingerprint.text && elText && elText === fingerprint.text.toLowerCase()) score += 45
    const elTestId = (
      el.getAttribute?.('data-testid') ||
      el.getAttribute?.('data-test-id') ||
      ''
    ).toLowerCase()
    if (fingerprint.dataTestId && elTestId && elTestId === fingerprint.dataTestId.toLowerCase())
      score += 40
    const elName = (el.getAttribute?.('name') || '').toLowerCase()
    if (fingerprint.name && elName && elName === fingerprint.name.toLowerCase()) score += 35
    const elPh = (el.getAttribute?.('placeholder') || '').toLowerCase()
    if (fingerprint.placeholder && elPh && elPh === fingerprint.placeholder.toLowerCase())
      score += 35
    if (fingerprint.classTokens?.length && (el as HTMLElement).classList) {
      const matching = fingerprint.classTokens.filter((t) =>
        (el as HTMLElement).classList.contains(t)
      )
      score += matching.length * 10
    }
  }
  if (kind === 'button') {
    const sendPatterns = ['send', 'gönder', 'gonder', 'submit', 'reply']
    if (sendPatterns.some((p) => ariaLabel.includes(p))) score += 30
    const title = (el.getAttribute?.('title') || '').toLowerCase()
    if (sendPatterns.some((p) => title.includes(p))) score += 20
    const testId = (
      el.getAttribute?.('data-testid') ||
      el.getAttribute?.('data-test-id') ||
      ''
    ).toLowerCase()
    if (sendPatterns.some((p) => testId.includes(p))) score += 25
    if (role === 'button' || tag === 'button' || (tag === 'input' && type === 'submit')) score += 20
    if (
      candidate.matchedSelector &&
      primarySelector &&
      candidate.matchedSelector === primarySelector
    )
      score += 15
  } else {
    const inputPatterns = ['message', 'ask', 'prompt', 'type', 'yaz', 'sor']
    if (inputPatterns.some((p) => ariaLabel.includes(p) || placeholder.includes(p))) score += 30
    if (role === 'textbox') score += 20
    if (isContentEditable) score += 10
    if (tag === 'textarea' || (tag === 'input' && (type === 'text' || type === 'search' || !type)))
      score += 15
    if (
      candidate.matchedSelector &&
      primarySelector &&
      candidate.matchedSelector === primarySelector
    )
      score += 15
  }
  try {
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const isVisible =
      rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    if (isVisible) score += 10
  } catch {}
  const isInteractive =
    !(el as HTMLButtonElement).disabled &&
    el.getAttribute?.('disabled') === null &&
    el.getAttribute?.('aria-disabled') !== 'true'
  if (isInteractive) score += 5
  let level: 'high' | 'medium' | 'low' = 'low'
  if (score >= CONFIDENCE_THRESHOLD_HIGH) level = 'high'
  else if (score >= CONFIDENCE_THRESHOLD_MEDIUM) level = 'medium'
  return { score, level }
}
