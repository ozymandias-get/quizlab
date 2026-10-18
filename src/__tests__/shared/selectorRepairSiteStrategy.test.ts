/**
 * Self-healing target integrity: the `siteStrategy` recovery must be a
 * first-class recovery (T17/T18 companions).
 *
 * Pre-hardening, a `siteStrategy` hit was used silently: it never counted as
 * a recovery, so it bypassed the ambiguity/confidence/priority gates AND left
 * no evidence. Post-hardening it is classified like the other recoveries.
 *
 * The vocabulary membership itself (`siteStrategy` ∈ AUTOMATION_LOOKUP_STRATEGIES
 * and ∈ RECOVERY_LOOKUP_STRATEGIES) is already pinned by the loops in
 * selectorRepair.test.ts, so only the two behaviours unique to this file are
 * kept here.
 */
import { describe, expect, it } from 'vitest'

import { classifyRepairEligibility } from '../../../shared/selectorRepair'

const HIGH_CONFIDENCE_BASE = {
  confidenceScore: 95,
  confidenceLevel: 'high' as const,
  stableSelector: 'button[aria-label="Send"]',
  ambiguous: false,
  unstableSelector: false,
  blockedSendControl: false,
  operationSucceeded: true
}

describe('siteStrategy recovery classification', () => {
  it('gates an eligible siteStrategy input recovery like other recoveries', () => {
    const verdict = classifyRepairEligibility({
      kind: 'input',
      strategy: 'siteStrategy',
      confidenceScore: 95,
      confidenceLevel: 'high',
      stableSelector: 'textarea[data-testid="ask"]',
      ambiguous: false,
      unstableSelector: false,
      blockedSendControl: false,
      operationSucceeded: true
    })
    expect(verdict).toEqual({ eligible: true, reason: 'eligible' })
  })

  it('refuses to promote a siteStrategy button recovery', () => {
    const verdict = classifyRepairEligibility({
      kind: 'button',
      strategy: 'siteStrategy',
      ...HIGH_CONFIDENCE_BASE
    })
    expect(verdict.eligible).toBe(false)
  })
})
