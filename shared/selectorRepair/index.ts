/**
 * Selector self-healing policy — canonical, cross-process source of truth.
 *
 * The runtime inside the AI webview already *finds* elements after the saved
 * selector breaks (fingerprint → semantic → provider/site strategy →
 * heuristic). This package owns the part that was missing: the deterministic
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
 *
 * Module map, in the order a recovery travels through them:
 *   policyThresholds     the numbers the injected runtime mirrors
 *   strategyVocabulary   the closed sets a repair record may speak in
 *   selectorValidation   the gate a selector must pass to be persistable
 *   evidenceTypes        the shared evidence vocabulary
 *   repairEvidence       eligibility verdict + ranking between two records
 *   repairCandidate      candidate identity + staged-success bookkeeping
 *   selectorPromotion    the staged → persisted transition + flapping guard
 */
export type { RepairEvidenceInput, SelectorRepairEvidence } from './evidenceTypes.js'
export {
  MAX_REPAIR_CANDIDATE_COUNT,
  MIN_AUTO_REPAIR_SCORE_GAP,
  REPAIR_FLAP_WINDOW_MS,
  REPAIR_SCORE_BONUS_INTERACTIVE,
  REPAIR_SCORE_BONUS_MAX,
  REPAIR_SCORE_BONUS_STABLE_SELECTOR,
  SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
} from './policyThresholds.js'
export {
  advanceRepairCandidate,
  buildRepairCandidateId,
  getRepairCandidate,
  isSameRepairCandidate
} from './repairCandidate.js'
export {
  classifyRepairEligibility,
  compareRepairEvidence,
  isUsableRepairEvidence
} from './repairEvidence.js'
export type { PromotedSelectors } from './selectorPromotion.js'
export {
  buildPromotedSelectors,
  isPromotionEligible,
  isRepairFlapping
} from './selectorPromotion.js'
export {
  getLocatorSelectorKeys,
  isInternalMarkerSelector,
  isPersistableSelector
} from './selectorValidation.js'
export {
  AUTOMATION_LOOKUP_STRATEGIES,
  CONFIDENCE_LEVELS,
  isConfidenceLevel,
  isLookupStrategy,
  isProviderDerivedStrategy,
  isRecoveryStrategy,
  normalizeConfidenceLevel,
  normalizeLookupStrategy,
  RECOVERY_LOOKUP_STRATEGIES,
  REPAIR_STRATEGY_TRUST_ORDER
} from './strategyVocabulary.js'
