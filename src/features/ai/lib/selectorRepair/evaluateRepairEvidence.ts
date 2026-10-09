/**
 * Self-healing: turn runtime repair evidence into a staged / promoted config
 * patch.
 *
 * This is the renderer-side half of the loop. It is deliberately a **pure**
 * function: it takes the current saved config plus the diagnostics of a real
 * send and returns either `null` ("nothing meaningful happened") or a patch to
 * persist. Persistence itself lives in `applySelectorRepair.ts`.
 *
 * All policy decisions come from `shared/selectorRepair.ts`, which is the
 * cross-process source of truth shared with the injected runtime and the
 * electron sanitizer. Nothing here re-implements a threshold.
 */
import {
  advanceRepairCandidate,
  buildPromotedSelectors,
  buildRepairCandidateId,
  classifyRepairEligibility,
  getLocatorSelectorKeys,
  getRepairCandidate,
  isPersistableSelector,
  isPromotionEligible,
  isRepairFlapping,
  normalizeConfidenceLevel,
  normalizeLookupStrategy
} from '@shared-core/selectorRepair'
import type {
  AiSelectorConfig,
  AutomationExecutionDiagnostics,
  AutomationLookupStrategy,
  ConfidenceLevel,
  SelectorLastRepair,
  SelectorRepairCandidate,
  SelectorRepairKind,
  SelectorRepairReason
} from '@shared-core/types'

const REPAIR_KINDS: readonly SelectorRepairKind[] = ['input', 'button']

export interface RepairEvaluationInput {
  config: AiSelectorConfig
  diagnostics: AutomationExecutionDiagnostics
  now?: number
}

export interface RepairEvaluation {
  /** The config patch to persist. */
  patch: AiSelectorConfig
  /** False when nothing meaningful changed and no write is warranted. */
  shouldPersist: boolean
  /** Human-readable reason per locator, for `[SelectorRepair]` logging. */
  reasons: Record<SelectorRepairKind, SelectorRepairReason>
  /** True when at least one locator was promoted to the primary selector. */
  promoted: boolean
}

const EMPTY_REASONS: Record<SelectorRepairKind, SelectorRepairReason> = {
  input: 'not_recovered',
  button: 'not_recovered'
}

/**
 * Locator-fingerprint source for a candidate. Only the sanitized subset the
 * identity hash reads is carried over; the full saved fingerprint already lives
 * in `inputFingerprint` / `buttonFingerprint`.
 */
function getSourceFingerprint(
  config: AiSelectorConfig,
  kind: SelectorRepairKind
): AiSelectorConfig['inputFingerprint'] {
  return kind === 'input' ? (config.inputFingerprint ?? null) : (config.buttonFingerprint ?? null)
}

function getLocatorDiagnostics(
  diagnostics: AutomationExecutionDiagnostics,
  kind: SelectorRepairKind
) {
  return kind === 'input' ? diagnostics.input : diagnostics.button
}

/**
 * Evaluates one locator's repair evidence against the current staged state.
 * Returns the next candidate plus whether the reason blocks staging entirely.
 */
function evaluateLocator(params: {
  config: AiSelectorConfig
  diagnostics: AutomationExecutionDiagnostics
  kind: SelectorRepairKind
  now: number
}): {
  candidate: SelectorRepairCandidate | null
  reason: SelectorRepairReason
  shouldPersist: boolean
} {
  const { config, diagnostics, kind, now } = params
  const locatorDiagnostics = getLocatorDiagnostics(diagnostics, kind)
  if (!locatorDiagnostics) {
    return { candidate: null, reason: 'not_recovered', shouldPersist: false }
  }

  const strategy: AutomationLookupStrategy =
    normalizeLookupStrategy(locatorDiagnostics.strategy) ?? 'none'
  const confidenceLevel: ConfidenceLevel =
    normalizeConfidenceLevel(locatorDiagnostics.confidenceLevel) ?? 'low'
  const stableSelector = isPersistableSelector(locatorDiagnostics.stableSelector)
    ? (locatorDiagnostics.stableSelector as string)
    : null

  const verdict = classifyRepairEligibility({
    kind,
    strategy,
    confidenceScore:
      typeof locatorDiagnostics.confidenceScore === 'number'
        ? locatorDiagnostics.confidenceScore
        : 0,
    confidenceLevel,
    stableSelector,
    ambiguous: locatorDiagnostics.ambiguous === true,
    unstableSelector: locatorDiagnostics.unstableSelector === true,
    // The send-control blocklist is enforced inside the runtime (which owns the
    // shared regex) and surfaces as an ineligible verdict; re-checked here so a
    // hand-built diagnostics object cannot bypass it.
    blockedSendControl: locatorDiagnostics.repairReason === 'blocked_send_control',
    operationSucceeded: locatorDiagnostics.operationSucceeded === true
  })

  if (!verdict.eligible || !stableSelector) {
    return { candidate: null, reason: verdict.reason, shouldPersist: false }
  }

  // The recovery resolved to the selector that is already the primary: there is
  // nothing to heal, so nothing is staged. This is the steady state after a
  // promotion and must not keep the counter alive forever.
  const primaryKey = getLocatorSelectorKeys(kind).primary
  if (config[primaryKey] === stableSelector) {
    return { candidate: null, reason: 'selector_unchanged', shouldPersist: false }
  }

  // `diagnostics.strategy` is 'cache' on a warm-cache hit; the original recovery
  // strategy travels in the evidence snapshot, which the runtime also mirrors
  // onto `repairReason`. When only a strategy name is available we keep the
  // reported one and refuse to stage anything we cannot classify.
  const candidateId = buildRepairCandidateId({
    selector: stableSelector,
    strategy,
    fingerprint: getSourceFingerprint(config, kind)
  })

  const previous = getRepairCandidate(config.repair, kind)
  const advanced = advanceRepairCandidate({
    previous,
    candidateId,
    selector: stableSelector,
    strategy,
    confidenceScore:
      typeof locatorDiagnostics.confidenceScore === 'number'
        ? locatorDiagnostics.confidenceScore
        : 0,
    confidenceLevel,
    now,
    sourceFingerprint: getSourceFingerprint(config, kind)
  })

  return {
    candidate: advanced.candidate,
    reason: verdict.reason,
    // Every staged observation is persisted, without exception.
    //
    // An earlier version only wrote on an identity change and on every Nth
    // success, reasoning that a counter ticking from 2 to 3 could be
    // recomputed. It cannot: the *next* send re-reads the persisted config, so a
    // skipped write pins the counter forever and the 1 → 2 → 2 → 2 chain never
    // reaches the threshold. With SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD = 3 the
    // cost of being correct is at most two small writes before the promotion
    // write, and correctness has to win over config churn.
    shouldPersist: true
  }
}

/**
 * Applies the staged → promoted transition for one locator.
 */
function promoteLocator(params: {
  config: AiSelectorConfig
  kind: SelectorRepairKind
  candidate: SelectorRepairCandidate
  now: number
}): { patch: AiSelectorConfig; promoted: boolean; blocked: boolean } {
  const { config, kind, candidate, now } = params
  const keys = getLocatorSelectorKeys(kind)
  const currentPrimary = config[keys.primary] ?? null
  const currentCandidates = config[keys.candidates] ?? null

  if (!isPromotionEligible(candidate, kind)) {
    return { patch: {}, promoted: false, blocked: false }
  }

  if (currentPrimary === candidate.selector) {
    // Already the persisted primary (re-promotion after a restart). Nothing to
    // rewrite; the repair marker is already on disk from the first promotion.
    return { patch: {}, promoted: false, blocked: false }
  }

  if (
    isRepairFlapping({
      lastRepair: config.lastRepair ?? null,
      kind,
      candidateSelector: candidate.selector as string,
      now
    })
  ) {
    // Anti-flap: a second, different selector may not replace a very recent
    // repair. The runtime already worked; the user gets a re-pick hint instead
    // of an endless selector rewrite loop.
    return { patch: { health: 'needs_repick' }, promoted: false, blocked: true }
  }

  const promoted = buildPromotedSelectors({
    currentPrimary,
    currentCandidates,
    repairSelector: candidate.selector as string
  })

  // Record the promotion. `lastRepair` is the only durable trace of it, and two
  // things depend on it: the flapping guard on the *next* drift, and the
  // "Auto-repaired" state the Settings panel shows. The other locator's entry is
  // preserved because input and button promote independently.
  const lastRepair = {
    ...(config.lastRepair ?? {}),
    repairedAt: now,
    ...(kind === 'input'
      ? { inputSelector: promoted.primary, inputStrategy: candidate.strategy }
      : { buttonSelector: promoted.primary, buttonStrategy: candidate.strategy })
  } satisfies SelectorLastRepair

  return {
    patch: {
      [keys.primary]: promoted.primary,
      [keys.candidates]: promoted.candidates,
      health: 'repaired',
      lastRepair
    },
    promoted: true,
    blocked: false
  }
}

/**
 * Main entry: evaluate repair evidence for both locators and return the patch to
 * persist, or `null` when the send produced no repair-worthy transition.
 */
export function evaluateSelectorRepairEvidence(
  input: RepairEvaluationInput
): RepairEvaluation | null {
  const { config, diagnostics } = input
  const now = input.now ?? Date.now()

  const reasons: Record<SelectorRepairKind, SelectorRepairReason> = { ...EMPTY_REASONS }
  const nextRepair: AiSelectorConfig['repair'] = {
    input: config.repair?.input ?? null,
    button: config.repair?.button ?? null
  }
  const patch: AiSelectorConfig = {}
  let shouldPersist = false
  let promoted = false
  let needsRepick = false
  // A staged counter only reaches disk when it actually moved (a fresh
  // observation) or when a previously staged candidate was dropped. A healthy
  // primary produces no candidate and therefore no write at all, so the normal
  // path stays churn-free.
  let repairStateChanged = false

  for (const kind of REPAIR_KINDS) {
    const evaluated = evaluateLocator({ config, diagnostics, kind, now })
    reasons[kind] = evaluated.reason

    if (!evaluated.candidate) {
      // A refused recovery must not leave a stale staged candidate behind: the
      // evidence says "this recovery is not trustworthy", so the old streak is
      // dropped instead of being carried into the next send. A plain
      // "not recovered" (nothing drifted) is silent — that is the common case
      // and must not cause a config write.
      if (config.repair?.[kind] && evaluated.reason !== 'not_recovered') {
        nextRepair[kind] = null
        repairStateChanged = true
        shouldPersist = true
      }
      continue
    }

    nextRepair[kind] = evaluated.candidate
    if (evaluated.shouldPersist) {
      repairStateChanged = true
      shouldPersist = true
    }

    const promotion = promoteLocator({ config, kind, candidate: evaluated.candidate, now })
    if (promotion.blocked) {
      reasons[kind] = 'flapping_repair'
      needsRepick = true
      continue
    }
    if (promotion.promoted) {
      promoted = true
      shouldPersist = true
      repairStateChanged = true
      Object.assign(patch, promotion.patch)
      // A promoted selector is the new baseline: clear the staged counter so the
      // next drift starts from zero instead of immediately re-promoting.
      nextRepair[kind] = null
      continue
    }
    if (Object.keys(promotion.patch).length > 0) {
      Object.assign(patch, promotion.patch)
      shouldPersist = true
    }
  }

  const repairState = nextRepair.input || nextRepair.button ? nextRepair : null
  if (repairStateChanged && JSON.stringify(repairState) !== JSON.stringify(config.repair ?? null)) {
    patch.repair = repairState
    shouldPersist = true
  }

  if (needsRepick && config.health !== 'needs_repick') {
    patch.health = 'needs_repick'
    shouldPersist = true
  }

  if (!shouldPersist) {
    return null
  }

  return { patch, shouldPersist, reasons, promoted }
}
