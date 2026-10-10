/**
 * Automation & Selector Types
 */

export type SubmitMode = 'click' | 'enter_key' | 'mixed'

export type TextInputMode = 'auto' | 'paste' | 'typing'

export const TEXT_INPUT_MODE_VALUES: readonly TextInputMode[] = ['auto', 'paste', 'typing'] as const

/**
 * Selector lifecycle health.
 *
 * - `ready`        – locator came from the user (Magic Selector) and works.
 * - `migrated`     – locator was carried over from an older config version.
 * - `repaired`     – the saved selector was automatically recovered and promoted
 *                    by the self-healing pipeline (see `shared/selectorRepair.ts`).
 * - `needs_repick` – the locator could not be recovered safely; the user has to
 *                    re-pick it with the Magic Selector.
 */
export type SelectorHealth = 'ready' | 'migrated' | 'repaired' | 'needs_repick'

export interface AutomationHostDescriptor {
  selector: string
  tag: string
  safeId?: string | null
  dataTestId?: string | null
  classTokens?: string[] | null
  nthChild?: number | null
}

export interface AutomationElementFingerprint {
  tag: string
  role?: string | null
  type?: string | null
  contentEditable?: boolean
  text?: string | null
  name?: string | null
  placeholder?: string | null
  ariaLabel?: string | null
  dataTestId?: string | null
  safeId?: string | null
  classTokens?: string[] | null
  localPath?: string[] | null
  hostChain?: AutomationHostDescriptor[] | null
}

export type AiSelectorConfig = {
  version?: 2
  input?: string | null
  button?: string | null
  waitFor?: string | null
  submitMode?: SubmitMode
  inputCandidates?: string[] | null
  buttonCandidates?: string[] | null
  inputFingerprint?: AutomationElementFingerprint | null
  buttonFingerprint?: AutomationElementFingerprint | null
  sourceUrl?: string | null
  sourceHostname?: string | null
  canonicalHostname?: string | null
  health?: SelectorHealth
  /**
   * Staged self-healing state. Purely additive: configs written before this
   * field existed sanitize to themselves, so no version bump is required.
   * `input` and `button` are tracked separately because a composer field and
   * its send button drift for different reasons and carry different risk.
   */
  repair?: SelectorRepairState | null
  /**
   * Bounded repair history: only the last promotion is retained. Never holds
   * DOM snapshots, page text, prompts or credentials.
   */
  lastRepair?: SelectorLastRepair | null
  [key: string]: unknown
}

export type AutomationConfig = AiSelectorConfig

export type AutomationLookupStrategy =
  | 'cache'
  | 'direct'
  | 'recursive'
  | 'fingerprint'
  | 'none'
  | 'candidate'
  | 'semantic'
  | 'provider'
  | 'siteStrategy'
  | 'heuristic'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

/** Which locator a repair record belongs to. */
export type SelectorRepairKind = 'input' | 'button'

/**
 * A recovered selector that has been observed working but is not yet (or no
 * longer) the persisted primary selector. Kept deliberately small: only
 * sanitizable primitives and a sanitized fingerprint subset.
 */
export interface SelectorRepairCandidate {
  /** Stable CSS selector proposed for promotion, or null when none is safe. */
  selector: string | null
  /** Runtime strategy that produced the recovery. */
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  firstSeenAt: number
  lastSeenAt: number
  successCount: number
  consecutiveSuccessCount: number
  sourceFingerprint?: AutomationElementFingerprint | null
}

export interface SelectorRepairState {
  input?: SelectorRepairCandidate | null
  button?: SelectorRepairCandidate | null
}

/** Bounded repair history. Only the most recent promotion is kept. */
export interface SelectorLastRepair {
  repairedAt: number
  inputSelector?: string | null
  buttonSelector?: string | null
  inputStrategy?: AutomationLookupStrategy | null
  buttonStrategy?: AutomationLookupStrategy | null
}

export interface AutomationSelectorDiagnostics {
  requestedSelector: string | null
  matchedSelector: string | null
  strategy: AutomationLookupStrategy
  durationMs: number
  waitIterations: number
  cacheHits: number
  cacheInvalidations: number
  interactiveRequired: boolean
  confidenceScore?: number
  confidenceLevel?: ConfidenceLevel
  fallbackAttempts?: number
  /**
   * True when the element was found by the recovery pipeline instead of the
   * saved primary selector (see `RECOVERY_LOOKUP_STRATEGIES`).
   */
  recovered?: boolean
  /**
   * Best stable CSS selector derived from the recovered element. Runtime-only
   * marker selectors (`fingerprint:…`, `semantic:auto`, `gemini:…`) never
   * reach this field.
   */
  stableSelector?: string | null
  /** True when the two best recovery candidates scored too close to each other. */
  ambiguous?: boolean
  /** True when the stable selector looked build-generated (CSS-in-JS class). */
  unstableSelector?: boolean
  /** Runtime verdict; the renderer turns this into staged repair state. */
  repairEligible?: boolean
  repairReason?: SelectorRepairReason
  /** True only after a real pipeline operation (typing / submit) succeeded. */
  operationSucceeded?: boolean
}

/** Serializable, bounded reason codes for a non-promoted recovery. */
export type SelectorRepairReason =
  | 'not_recovered'
  | 'medium_confidence'
  | 'low_confidence'
  | 'ambiguous_candidates'
  | 'no_stable_selector'
  | 'unstable_selector'
  | 'blocked_send_control'
  | 'operation_failed'
  | 'selector_unchanged'
  | 'flapping_repair'
  | 'eligible'

export interface AutomationExecutionDiagnostics {
  kind: 'focus' | 'auto_send' | 'click_send' | 'validate' | 'submit_ready'
  pageUrl: string
  totalMs: number
  input: AutomationSelectorDiagnostics
  button?: AutomationSelectorDiagnostics
  setInputMs: number
  submitMs: number
  error: string | null
}

export interface AutomationExecutionResult {
  success: boolean
  error?: string
  mode?: string
  action?: string
  /**
   * Why a submit-ready wait gave up. `submit_not_ready` alone cannot
   * distinguish "the button is still disabled while the upload finishes" from
   * "the selector matched a hidden placeholder", and those need different fixes.
   */
  notReadyReason?: string
  /** Which lookup the wait was blocked on: `button` or `input`. */
  notReadyTarget?: string
  /** How long the wait actually ran, and the budget it was allowed. */
  waitedMs?: number
  budgetMs?: number
  minimumWaitMs?: number
  /**
   * Whether the submit target was ever interactive during the wait. `false`
   * alongside a low `mutationCount` means the paste likely attached nothing.
   */
  everReady?: boolean
  mutationCount?: number
  sinceLastMutationMs?: number
  checkIterations?: number
  diagnostics?: AutomationExecutionDiagnostics
}
