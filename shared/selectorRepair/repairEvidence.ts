/**
 * The persistence verdict: may this recovery become a permanent selector?
 *
 * Pure policy, no side effects — the runtime mirrors the same branch order into
 * its injected script so diagnostics and this function cannot disagree about
 * *why* a recovery was refused.
 */
import type { SelectorRepairKind, SelectorRepairReason } from '../types/automation.js'
import type { RepairEvidenceInput, SelectorRepairEvidence } from './evidenceTypes.js'
import { isPersistableSelector } from './selectorValidation.js'
import {
  getStrategyTrustRank,
  isProviderDerivedStrategy,
  isRecoveryStrategy
} from './strategyVocabulary.js'

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
