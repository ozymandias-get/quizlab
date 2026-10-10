/**
 * Self-healing target integrity: the `siteStrategy` recovery must be a
 * first-class recovery (T17/T18 companions).
 *
 * Pre-hardening, a `siteStrategy` hit was used silently: it never counted as
 * a recovery, so it bypassed the ambiguity/confidence/priority gates AND left
 * no evidence. Post-hardening it is classified like the other recoveries.
 */
import { describe, expect, it } from 'vitest'

import {
  classifyRepairEligibility,
  isLookupStrategy,
  isProviderDerivedStrategy,
  isRecoveryStrategy,
  normalizeLookupStrategy
} from '../../../shared/selectorRepair'

describe('siteStrategy recovery classification', () => {
  it('recognizes siteStrategy as a lookup strategy', () => {
    expect(isLookupStrategy('siteStrategy')).toBe(true)
    expect(normalizeLookupStrategy('siteStrategy')).toBe('siteStrategy')
  })

  it('treats siteStrategy as a recovery (never a silent hit)', () => {
    expect(isRecoveryStrategy('siteStrategy')).toBe(true)
  })

  it('holds siteStrategy to the provider-derived bar', () => {
    expect(isProviderDerivedStrategy('siteStrategy')).toBe(true)
  })

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
      confidenceScore: 95,
      confidenceLevel: 'high',
      stableSelector: 'button[aria-label="Send"]',
      ambiguous: false,
      unstableSelector: false,
      blockedSendControl: false,
      operationSucceeded: true
    })
    expect(verdict.eligible).toBe(false)
  })
})
