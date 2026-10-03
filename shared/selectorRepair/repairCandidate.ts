/**
 * Candidate identity and the staged-success state machine.
 *
 * A candidate is only ever *staged* here. Turning a staged candidate into the
 * persisted primary selector is `selectorPromotion`'s job, so the "how many
 * real successes has this identity earned" bookkeeping stays separate from the
 * "may it be written" decision.
 */
import type {
  AutomationElementFingerprint,
  AutomationLookupStrategy,
  ConfidenceLevel,
  SelectorRepairCandidate,
  SelectorRepairKind,
  SelectorRepairState
} from '../types/automation.js'

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

/** The first observation of a recovery identity: streak starts at one success. */
function createRepairCandidate(params: {
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

export function getRepairCandidate(
  state: SelectorRepairState | null | undefined,
  kind: SelectorRepairKind
): SelectorRepairCandidate | null {
  const candidate = state?.[kind]
  return candidate ?? null
}
