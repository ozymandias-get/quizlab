/**
 * The staged → promoted transition and the anti-flap guard around it.
 *
 * Promotion is the only place that decides which selector becomes the persisted
 * primary, so the threshold check, the candidate-list rewrite and the flapping
 * window all live together and can be read as one decision.
 */
import type {
  SelectorLastRepair,
  SelectorRepairCandidate,
  SelectorRepairKind
} from '../types/automation.js'
import {
  MAX_REPAIR_CANDIDATE_COUNT,
  REPAIR_FLAP_WINDOW_MS,
  SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
} from './policyThresholds.js'
import { isPersistableSelector } from './selectorValidation.js'
import { isProviderDerivedStrategy } from './strategyVocabulary.js'

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
