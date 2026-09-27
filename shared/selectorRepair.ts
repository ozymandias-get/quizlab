/**
 * Selector self-healing policy — canonical, cross-process source of truth.
 *
 * The runtime inside the AI webview already *finds* elements after the saved
 * selector breaks (fingerprint → semantic → provider/site strategy →
 * heuristic). This module owns the part that was missing: the deterministic
 * policy that decides whether a recovery is allowed to become persistent.
 *
 * Design constraints:
 * - No DOM, no Electron, no React: pure data + string policy so the same rules
 *   can be unit-tested, mirrored into the injected runtime constants and reused
 *   by the renderer before it writes to disk.
 * - No LLM, no network, no new dependencies.
 * - Staged: nothing is written on the first successful recovery.
 *
 * State machine (one step per locator kind):
 *
 *   healthy ──selector failure──▶ recovered
 *   recovered ──high confidence + real success──▶ candidate
 *   candidate ──consecutiveSuccessCount ≥ threshold──▶ promoted
 *   recovered ──low confidence / ambiguity / blocked control──▶ needs_repick
 */
import type {
  AutomationElementFingerprint,
  AutomationLookupStrategy,
  ConfidenceLevel,
  SelectorLastRepair,
  SelectorRepairCandidate,
  SelectorRepairKind,
  SelectorRepairReason,
  SelectorRepairState
} from './types/automation.js'

/**
 * Consecutive *real* pipeline successes (text insertion for the input, a
 * successful submit/click for the button) required before a staged repair
 * candidate may be promoted to the primary selector. Both locators share the
 * threshold so a single constant governs the loop; the button additionally has
 * to clear the stricter stability gate in `isPromotableSelector`.
 */
export const SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD = 3

/**
 * Minimum score gap between the best and the runner-up recovery candidate.
 *
 * `computeConfidenceScore` in the injected runtime produces integer scores, and
 * two candidates only differ by their semantic / attribute signals. A 15-point
 * window is roughly one strong signal (fingerprint aria-label = 40, role = 20,
 * editable = 10), so anything closer is treated as "we cannot tell them apart"
 * and never auto-promoted. The runtime reports `ambiguous` when the gap is
 * below this value.
 */
export const MIN_AUTO_REPAIR_SCORE_GAP = 15

/**
 * Time window used for repair-loop (flapping) protection. Inside the window a
 * second, *different* selector may not be promoted for the same locator, which
 * stops `A → repair B → repair A → repair B` ping-pong. The window is
 * deliberately short: long-term drift of a site should still be repairable.
 */
export const REPAIR_FLAP_WINDOW_MS = 10 * 60 * 1000

/** Maximum number of candidates kept after a promotion (mirrors the sanitizer cap). */
export const MAX_REPAIR_CANDIDATE_COUNT = 12

/**
 * Bounded bonuses added on top of the canonical `computeConfidenceScore` when a
 * recovery is being scored *for persistence*.
 *
 * The base score is deliberately pessimistic because it also has to gate the
 * runtime fallback ("is this element good enough to click right now?"), where a
 * false accept is a wrong click. Two facts that the base score cannot see are
 * nevertheless strong evidence when the question is "is this selector good
 * enough to remember?":
 *
 *   - a stable, non-marker CSS selector could be re-derived for the element
 *     (the Magic Selector's own generator accepted it, generated ids/classes
 *     rejected);
 *   - the element already passed the runtime's interaction gate, i.e. it is
 *     visible, enabled and not aria-disabled.
 *
 * Both are objective, cheap and verifiable, and both are added with a hard cap
 * so the adjustment can never manufacture confidence out of nothing.
 */
export const REPAIR_SCORE_BONUS_STABLE_SELECTOR = 25
export const REPAIR_SCORE_BONUS_INTERACTIVE = 10
export const REPAIR_SCORE_BONUS_MAX =
  REPAIR_SCORE_BONUS_STABLE_SELECTOR + REPAIR_SCORE_BONUS_INTERACTIVE

/** Every lookup strategy the runtime can report. Keeps string drift impossible. */
export const AUTOMATION_LOOKUP_STRATEGIES = [
  'cache',
  'direct',
  'recursive',
  'fingerprint',
  'none',
  'candidate',
  'semantic',
  'provider',
  'heuristic'
] as const satisfies readonly AutomationLookupStrategy[]

export const CONFIDENCE_LEVELS = [
  'high',
  'medium',
  'low'
] as const satisfies readonly ConfidenceLevel[]

/**
 * Strategies that mean "the saved selector no longer describes the page".
 *
 * `cache` / `direct` / `recursive` are normal use of a selector that still
 * works, and `none` means nothing was resolved. `candidate` counts as a
 * recovery because the runtime only reports it for a *non-primary* entry of the
 * saved candidate list, i.e. the primary went stale and a fallback carried us.
 * The rest are explicit recovery strategies.
 */
export const RECOVERY_LOOKUP_STRATEGIES = [
  'candidate',
  'fingerprint',
  'semantic',
  'provider',
  'heuristic'
] as const satisfies readonly AutomationLookupStrategy[]

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

export function isLookupStrategy(value: unknown): value is AutomationLookupStrategy {
  return (
    typeof value === 'string' && (AUTOMATION_LOOKUP_STRATEGIES as readonly string[]).includes(value)
  )
}

export function normalizeLookupStrategy(value: unknown): AutomationLookupStrategy | undefined {
  return isLookupStrategy(value) ? value : undefined
}

export function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return typeof value === 'string' && (CONFIDENCE_LEVELS as readonly string[]).includes(value)
}

export function normalizeConfidenceLevel(value: unknown): ConfidenceLevel | undefined {
  return isConfidenceLevel(value) ? value : undefined
}

/** True when the strategy indicates the saved selector went stale. */
export function isRecoveryStrategy(strategy: unknown): boolean {
  return (
    isLookupStrategy(strategy) &&
    (RECOVERY_LOOKUP_STRATEGIES as readonly string[]).includes(strategy)
  )
}

/**
 * Persistence risk ranking. Heuristic / provider recoveries may well be right
 * at runtime, but they are the least trustworthy as a permanent selector, so
 * they are never promoted automatically (§ "Provider-specific hardcoded
 * fallback … hemen permanent selector'a çevrilmemeli").
 */
export function isProviderDerivedStrategy(strategy: unknown): boolean {
  return strategy === 'provider' || strategy === 'heuristic'
}

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

/**
 * Deterministic identity for a repair candidate. Deliberately built from the
 * selector, the strategy and a small normalized fingerprint subset — never from
 * a raw DOM hash, so the same logical recovery keeps the same identity across
 * processes and restarts.
 */
export function buildRepairCandidateId(params: {
  selector: string | null
  strategy: AutomationLookupStrategy
  fingerprint?: AutomationElementFingerprint | null
}): string {
  const { selector, strategy, fingerprint } = params
  const fingerprintKey = fingerprint
    ? [
        fingerprint.tag,
        fingerprint.role,
        fingerprint.type,
        fingerprint.ariaLabel,
        fingerprint.dataTestId,
        fingerprint.safeId,
        fingerprint.placeholder
      ]
        .filter((part) => typeof part === 'string' && part.length > 0)
        .join('|')
        .toLowerCase()
    : ''
  return `${selector ?? ''}::${strategy}::${fingerprintKey}`
}

/** Alias kept short for call sites inside the repair loop. */
export function isSameRepairCandidate(
  previous: SelectorRepairCandidate | null,
  next: string
): boolean {
  if (!previous) return false
  return (
    buildRepairCandidateId({
      selector: previous.selector,
      strategy: previous.strategy,
      fingerprint: previous.sourceFingerprint
    }) === next
  )
}

export interface RepairEvidenceInput {
  kind: SelectorRepairKind
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  stableSelector: string | null
  /** True when the two best recovery candidates were within the score gap. */
  ambiguous: boolean
  /** True when the stable selector looked build-generated. */
  unstableSelector: boolean
  /** True when a send-control blocklist rejected the element. */
  blockedSendControl: boolean
  /** True only after the real pipeline operation (typing / submit) succeeded. */
  operationSucceeded: boolean
}

/**
 * Runtime-facing verdict. Mirrors the injected runtime's
 * `REPAIR_REASON_*` mapping so diagnostics and the renderer policy can never
 * disagree about *why* a recovery was refused.
 */
export function classifyRepairEligibility(evidence: RepairEvidenceInput): {
  eligible: boolean
  reason: SelectorRepairReason
} {
  // "The saved selector still works" is checked first: it is the most
  // fundamental and most actionable fact, and reporting a failure for a locator
  // that was never recovered is misleading. Both verdicts are ineligible, so the
  // ordering only sharpens the reason, it never relaxes a gate.
  if (!isRecoveryStrategy(evidence.strategy)) {
    return { eligible: false, reason: 'not_recovered' }
  }
  if (!evidence.operationSucceeded) {
    return { eligible: false, reason: 'operation_failed' }
  }
  if (evidence.blockedSendControl) {
    return { eligible: false, reason: 'blocked_send_control' }
  }
  if (evidence.confidenceLevel === 'low') {
    return { eligible: false, reason: 'low_confidence' }
  }
  if (evidence.ambiguous) {
    return { eligible: false, reason: 'ambiguous_candidates' }
  }
  if (!isPersistableSelector(evidence.stableSelector)) {
    return { eligible: false, reason: 'no_stable_selector' }
  }
  if (evidence.unstableSelector) {
    return { eligible: false, reason: 'unstable_selector' }
  }
  // Medium confidence is allowed to *use* the element at runtime but is never
  // learned. Provider/heuristic recoveries are held to the same bar and are
  // additionally ranked below direct/fingerprint/semantic by strategy risk.
  if (evidence.confidenceLevel === 'medium') {
    return { eligible: false, reason: 'medium_confidence' }
  }
  if (isProviderDerivedStrategy(evidence.strategy) && evidence.kind === 'button') {
    return { eligible: false, reason: 'medium_confidence' }
  }
  return { eligible: true, reason: 'eligible' }
}

export function createRepairCandidate(params: {
  selector: string | null
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  now: number
  sourceFingerprint?: AutomationElementFingerprint | null
}): SelectorRepairCandidate {
  const { selector, strategy, confidenceScore, confidenceLevel, now, sourceFingerprint } = params
  return {
    selector,
    strategy,
    confidenceScore,
    confidenceLevel,
    firstSeenAt: now,
    lastSeenAt: now,
    successCount: 1,
    consecutiveSuccessCount: 1,
    sourceFingerprint: sourceFingerprint ?? null
  }
}

/**
 * Advances the staged candidate for one locator.
 *
 * When the recovered identity is unchanged the consecutive counter grows; the
 * moment the recovery resolves to something *else* the new candidate starts
 * from 1, so a previously earned streak can never be carried over and a
 * flapping recovery can never accumulate enough successes to be promoted.
 */
export function advanceRepairCandidate(params: {
  previous: SelectorRepairCandidate | null | undefined
  candidateId: string
  selector: string | null
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  now: number
  sourceFingerprint?: AutomationElementFingerprint | null
}): { candidate: SelectorRepairCandidate; identityChanged: boolean } {
  const { previous, candidateId, selector, strategy, confidenceScore, confidenceLevel, now } =
    params
  const sourceFingerprint = params.sourceFingerprint ?? null
  const identityChanged = previous ? !isSameRepairCandidate(previous, candidateId) : true

  if (!previous || identityChanged) {
    return {
      candidate: createRepairCandidate({
        selector,
        strategy,
        confidenceScore,
        confidenceLevel,
        now,
        sourceFingerprint
      }),
      identityChanged: true
    }
  }

  return {
    candidate: {
      ...previous,
      selector,
      strategy,
      confidenceScore,
      confidenceLevel,
      lastSeenAt: now,
      successCount: previous.successCount + 1,
      consecutiveSuccessCount: previous.consecutiveSuccessCount + 1,
      sourceFingerprint: sourceFingerprint ?? previous.sourceFingerprint
    },
    identityChanged: false
  }
}

/** True when the staged candidate may become the persisted primary selector. */
export function isPromotionEligible(
  candidate: SelectorRepairCandidate | null | undefined,
  kind: SelectorRepairKind
): boolean {
  if (!candidate?.selector) return false
  if (candidate.confidenceLevel !== 'high') return false
  if (!isPersistableSelector(candidate.selector)) return false
  if (candidate.consecutiveSuccessCount < SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD) return false
  if (kind === 'button' && isProviderDerivedStrategy(candidate.strategy)) return false
  return true
}

export function getRepairCandidate(
  state: SelectorRepairState | null | undefined,
  kind: SelectorRepairKind
): SelectorRepairCandidate | null {
  const candidate = state?.[kind]
  return candidate ?? null
}

/**
 * Flapping guard. Blocks a *second, different* promotion for the same locator
 * inside `REPAIR_FLAP_WINDOW_MS`, while remaining idempotent when the very same
 * selector is seen again.
 */
export function isRepairFlapping(params: {
  lastRepair: SelectorLastRepair | null | undefined
  kind: SelectorRepairKind
  candidateSelector: string
  now: number
}): boolean {
  const { lastRepair, kind, candidateSelector, now } = params
  if (!lastRepair) return false
  const previousSelector = kind === 'input' ? lastRepair.inputSelector : lastRepair.buttonSelector
  if (!previousSelector) return false
  if (now - lastRepair.repairedAt > REPAIR_FLAP_WINDOW_MS) return false
  return previousSelector !== candidateSelector
}

export interface PromotedSelectors {
  primary: string
  candidates: string[]
}

/**
 * Moves the old primary into the fallback candidate list rather than deleting
 * it, so a promoted selector can always fall back to what used to work.
 * Order is `newPrimary → oldPrimary → remaining candidates`, de-duplicated and
 * capped at `MAX_REPAIR_CANDIDATE_COUNT`. The new primary stays at the head of
 * the list as well: `serializeAutomationConfig` already unions the primary with
 * the candidates and de-duplicates, so listing it keeps the persisted shape
 * self-describing (a reader of the config sees the active selector first).
 */
export function buildPromotedSelectors(params: {
  currentPrimary: string | null | undefined
  currentCandidates: string[] | null | undefined
  repairSelector: string
  maxCount?: number
}): PromotedSelectors {
  const { currentPrimary, currentCandidates, repairSelector } = params
  const maxCount = params.maxCount ?? MAX_REPAIR_CANDIDATE_COUNT
  const ordered: string[] = []

  for (const entry of [repairSelector, currentPrimary, ...(currentCandidates ?? [])]) {
    if (typeof entry !== 'string') continue
    const normalized = entry.trim()
    if (!normalized) continue
    if (ordered.includes(normalized)) continue
    ordered.push(normalized)
  }

  return {
    primary: ordered[0] ?? repairSelector,
    candidates: ordered.slice(0, maxCount)
  }
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

/**
 * A single locator's recovery evidence, reduced to what the policy needs.
 *
 * The renderer builds these from `AutomationSelectorDiagnostics` so evidence
 * selection and promotion share one vocabulary instead of growing a second
 * scoring path.
 */
export interface SelectorRepairEvidence {
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  stableSelector: string | null
  ambiguous: boolean
  unstableSelector: boolean
  blockedSendControl: boolean
  operationSucceeded: boolean
}

/**
 * Strategy trust order, lowest risk first.
 *
 * A recovery that came from the user's own saved candidate list is the most
 * trustworthy ("the primary drifted, a fallback carried us"), then a fingerprint
 * match, then semantics inferred from the page, then the provider guesses.
 *
 * This is the same ordering the persistence policy already enforces
 * (`isProviderDerivedStrategy` refuses button promotion outright); it is exposed
 * as an explicit list so ranking several evidence records inside one logical
 * send uses the canonical source instead of a parallel score.
 */
export const REPAIR_STRATEGY_TRUST_ORDER = [
  'candidate',
  'fingerprint',
  'semantic',
  'provider',
  'heuristic'
] as const satisfies readonly AutomationLookupStrategy[]

function getStrategyTrustRank(strategy: AutomationLookupStrategy): number {
  const index = (REPAIR_STRATEGY_TRUST_ORDER as readonly string[]).indexOf(strategy)
  // Unknown strategies sort last so a regression can never outrank a known one.
  return index >= 0 ? index : REPAIR_STRATEGY_TRUST_ORDER.length
}

/** True when the evidence clears every persistence gate for this locator kind. */
export function isUsableRepairEvidence(
  kind: SelectorRepairKind,
  evidence: SelectorRepairEvidence
): boolean {
  return classifyRepairEligibility({ kind, ...evidence }).eligible
}

/**
 * Orders two evidence records for the same locator, best first.
 *
 * `> 0` means `a` is the better record; `< 0` means `b` is. The ordering is
 * total and deterministic so the winner never depends on which internal script
 * happened to finish first:
 *
 *   1. usable evidence always beats refused evidence, so an ambiguous or
 *      blocklisted record can never displace a trustworthy one;
 *   2. then the canonical strategy trust order (lower risk wins);
 *   3. then the higher confidence score;
 *   4. then a present stable selector over an absent one;
 *   5. finally a stable string comparison, purely to break exact ties.
 */
export function compareRepairEvidence(
  kind: SelectorRepairKind,
  a: SelectorRepairEvidence,
  b: SelectorRepairEvidence
): number {
  const aUsable = isUsableRepairEvidence(kind, a) ? 1 : 0
  const bUsable = isUsableRepairEvidence(kind, b) ? 1 : 0
  if (aUsable !== bUsable) return aUsable - bUsable

  // A lower trust rank is better, so subtract in that order to keep every
  // clause of this comparator pointing the same way ("> 0 means a is better").
  const trustDelta = getStrategyTrustRank(b.strategy) - getStrategyTrustRank(a.strategy)
  if (trustDelta !== 0) return trustDelta

  if (a.confidenceScore !== b.confidenceScore) return a.confidenceScore - b.confidenceScore

  const aSelector = a.stableSelector ?? ''
  const bSelector = b.stableSelector ?? ''
  if (aSelector !== bSelector) return aSelector < bSelector ? -1 : 1

  return 0
}
