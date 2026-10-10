/**
 * The closed vocabularies a repair record is allowed to speak in.
 *
 * The injected runtime reports a strategy name as a plain string over IPC, so
 * the only thing standing between a malformed payload and the persisted repair
 * record is the set of names this module accepts.
 */
import type { AutomationLookupStrategy, ConfidenceLevel } from '../types/automation.js'

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
  'siteStrategy',
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
  'siteStrategy',
  'heuristic'
] as const satisfies readonly AutomationLookupStrategy[]

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
  'siteStrategy',
  'heuristic'
] as const satisfies readonly AutomationLookupStrategy[]

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
  return strategy === 'provider' || strategy === 'siteStrategy' || strategy === 'heuristic'
}

export function getStrategyTrustRank(strategy: AutomationLookupStrategy): number {
  const index = (REPAIR_STRATEGY_TRUST_ORDER as readonly string[]).indexOf(strategy)
  // Unknown strategies sort last so a regression can never outrank a known one.
  return index >= 0 ? index : REPAIR_STRATEGY_TRUST_ORDER.length
}
