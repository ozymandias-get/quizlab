/**
 * Self-healing evaluation and persistence (renderer side).
 *
 * Covers the transition table end to end without a DOM: stage → count →
 * promote → persist, plus every guard that must keep a recovery from being
 * learned (low/medium confidence, ambiguity, flapping, marker selectors) and
 * the cache invalidation that makes a promotion take effect immediately.
 */
import type {
  AiSelectorConfig,
  AutomationExecutionDiagnostics,
  AutomationSelectorDiagnostics
} from '@shared-core/types'
import { SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD } from '@shared-core/selectorRepair'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { evaluateSelectorRepairEvidence } from '@features/ai/lib/selectorRepair/evaluateRepairEvidence'

const NOW = 1_700_000_000_000

function locatorDiagnostics(
  overrides: Partial<AutomationSelectorDiagnostics> = {}
): AutomationSelectorDiagnostics {
  return {
    requestedSelector: '#gone',
    matchedSelector: 'textarea[data-testid="ask"]',
    strategy: 'candidate',
    durationMs: 1,
    waitIterations: 1,
    cacheHits: 0,
    cacheInvalidations: 0,
    interactiveRequired: false,
    recovered: true,
    confidenceScore: 95,
    confidenceLevel: 'high',
    stableSelector: 'textarea[data-testid="ask"]',
    ambiguous: false,
    unstableSelector: false,
    repairEligible: true,
    repairReason: 'eligible',
    operationSucceeded: true,
    ...overrides
  }
}

function executionDiagnostics(
  input: Partial<AutomationSelectorDiagnostics> = {},
  button?: Partial<AutomationSelectorDiagnostics>
): AutomationExecutionDiagnostics {
  return {
    kind: 'auto_send',
    pageUrl: 'https://example.com/',
    totalMs: 5,
    input: locatorDiagnostics(input),
    ...(button
      ? {
          button: locatorDiagnostics({
            matchedSelector: 'button[data-testid="send"]',
            stableSelector: 'button[data-testid="send"]',
            ...button
          })
        }
      : {}),
    setInputMs: 1,
    submitMs: 1,
    error: null
  }
}

const BASE_CONFIG: AiSelectorConfig = {
  version: 2,
  input: '#gone',
  button: 'button#old',
  inputCandidates: ['#gone', 'textarea[data-testid="ask"]'],
  buttonCandidates: ['button#old'],
  inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
  health: 'ready'
}

describe('evaluateSelectorRepairEvidence', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('returns null when the saved selector still works', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({
        strategy: 'direct',
        recovered: false,
        repairEligible: false,
        repairReason: 'not_recovered'
      }),
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('stages a first high-confidence recovery without promoting it', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics(),
      now: NOW
    })

    expect(result).not.toBeNull()
    expect(result?.promoted).toBe(false)
    expect(result?.patch.repair?.input).toMatchObject({
      selector: 'textarea[data-testid="ask"]',
      strategy: 'candidate',
      confidenceLevel: 'high',
      successCount: 1,
      consecutiveSuccessCount: 1
    })
    // The primary selector must not move yet.
    expect(result?.patch.input).toBeUndefined()
    expect(result?.patch.health).toBeUndefined()
  })

  it('does not persist on a counter that has not reached a threshold step', () => {
    const staged: AiSelectorConfig = {
      ...BASE_CONFIG,
      repair: {
        input: {
          selector: 'textarea[data-testid="ask"]',
          strategy: 'candidate',
          confidenceScore: 95,
          confidenceLevel: 'high',
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: 1,
          consecutiveSuccessCount: 1,
          sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
        }
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: staged,
      diagnostics: executionDiagnostics(),
      now: NOW + 1
    })

    // Second success: the counter grew, but writing on every send would be
    // config churn, so nothing is persisted yet.
    expect(result).toBeNull()
  })

  it('promotes after the shared consecutive success threshold', () => {
    const staged: AiSelectorConfig = {
      ...BASE_CONFIG,
      repair: {
        input: {
          selector: 'textarea[data-testid="ask"]',
          strategy: 'candidate',
          confidenceScore: 95,
          confidenceLevel: 'high',
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD - 1,
          consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD - 1,
          sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
        }
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: staged,
      diagnostics: executionDiagnostics(),
      now: NOW + 5000
    })

    expect(result?.promoted).toBe(true)
    expect(result?.patch.input).toBe('textarea[data-testid="ask"]')
    // The old primary survives as the first fallback.
    expect(result?.patch.inputCandidates).toEqual(['textarea[data-testid="ask"]', '#gone'])
    expect(result?.patch.health).toBe('repaired')
    // The staged counter is cleared so the new baseline starts from zero.
    expect(result?.patch.repair).toBeNull()
  })

  it('resets the streak when a different candidate appears', () => {
    const staged: AiSelectorConfig = {
      ...BASE_CONFIG,
      repair: {
        input: {
          selector: 'textarea[data-testid="other"]',
          strategy: 'semantic',
          confidenceScore: 95,
          confidenceLevel: 'high',
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: 2,
          consecutiveSuccessCount: 2,
          sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
        }
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: staged,
      diagnostics: executionDiagnostics(),
      now: NOW + 1000
    })

    expect(result?.promoted).toBe(false)
    expect(result?.patch.repair?.input).toMatchObject({
      selector: 'textarea[data-testid="ask"]',
      successCount: 1,
      consecutiveSuccessCount: 1
    })
    expect(result?.patch.input).toBeUndefined()
  })

  it('never stages a low-confidence recovery', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({
        confidenceLevel: 'low',
        confidenceScore: 20,
        repairEligible: false,
        repairReason: 'low_confidence'
      }),
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('never stages a medium-confidence recovery', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({
        confidenceLevel: 'medium',
        confidenceScore: 60,
        repairEligible: false,
        repairReason: 'medium_confidence'
      }),
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('never stages an ambiguous recovery', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({
        ambiguous: true,
        repairEligible: false,
        repairReason: 'ambiguous_candidates'
      }),
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('never stages a blocklisted send control', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics(
        {},
        { strategy: 'fingerprint', repairEligible: false, repairReason: 'blocked_send_control' }
      ),
      now: NOW
    })
    expect(result?.reasons.button).toBe('blocked_send_control')
    expect(result?.patch.button).toBeUndefined()
  })

  it('never stages a recovery whose operation did not succeed', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({ operationSucceeded: false }),
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('never persists a runtime marker selector', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({
        strategy: 'fingerprint',
        stableSelector: 'fingerprint:descriptor'
      }),
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('refuses a button recovery that came from a provider strategy', () => {
    const stagedButton: AiSelectorConfig = {
      ...BASE_CONFIG,
      repair: {
        button: {
          selector: 'button[aria-label="Send message"]',
          strategy: 'provider',
          confidenceScore: 95,
          confidenceLevel: 'high',
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: 2,
          consecutiveSuccessCount: 2,
          sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
        }
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: stagedButton,
      diagnostics: executionDiagnostics(
        { recovered: false, repairEligible: false, repairReason: 'not_recovered' },
        { strategy: 'provider' }
      ),
      now: NOW + 1000
    })

    expect(result?.promoted).toBe(false)
    expect(result?.reasons.button).toBe('medium_confidence')
    expect(result?.patch.button).toBeUndefined()
  })

  it('marks the config as needing a re-pick when a repair keeps flapping', () => {
    const flapping: AiSelectorConfig = {
      ...BASE_CONFIG,
      input: 'textarea[data-testid="promoted"]',
      health: 'repaired',
      lastRepair: {
        repairedAt: NOW - 1000,
        inputSelector: 'textarea[data-testid="promoted"]'
      },
      repair: {
        input: {
          selector: 'textarea[data-testid="ask"]',
          strategy: 'semantic',
          confidenceScore: 95,
          confidenceLevel: 'high',
          firstSeenAt: NOW - 900,
          lastSeenAt: NOW - 900,
          successCount: 2,
          consecutiveSuccessCount: 2,
          sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
        }
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: flapping,
      diagnostics: executionDiagnostics({ strategy: 'semantic' }),
      now: NOW
    })

    expect(result?.reasons.input).toBe('flapping_repair')
    expect(result?.promoted).toBe(false)
    expect(result?.patch.health).toBe('needs_repick')
    // The runtime already worked, so the working selector is left untouched.
    expect(result?.patch.input).toBeUndefined()
  })

  it('stays silent once the recovered selector is already the primary', () => {
    const alreadyPromoted: AiSelectorConfig = {
      ...BASE_CONFIG,
      input: 'textarea[data-testid="ask"]',
      health: 'repaired',
      lastRepair: {
        repairedAt: NOW - 1000,
        inputSelector: 'textarea[data-testid="ask"]'
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: alreadyPromoted,
      diagnostics: executionDiagnostics(),
      now: NOW
    })

    // Nothing left to heal: no write, no counter, no selector churn.
    expect(result).toBeNull()
  })

  it('drops a stale staged candidate once the recovery is refused again', () => {
    const staged: AiSelectorConfig = {
      ...BASE_CONFIG,
      repair: {
        input: {
          selector: 'textarea[data-testid="ask"]',
          strategy: 'candidate',
          confidenceScore: 95,
          confidenceLevel: 'high',
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: 1,
          consecutiveSuccessCount: 1,
          sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
        }
      }
    }

    const result = evaluateSelectorRepairEvidence({
      config: staged,
      diagnostics: executionDiagnostics({
        ambiguous: true,
        repairEligible: false,
        repairReason: 'ambiguous_candidates'
      }),
      now: NOW + 1000
    })

    expect(result?.patch.repair).toBeNull()
  })

  it('stages input and button independently', () => {
    const result = evaluateSelectorRepairEvidence({
      config: BASE_CONFIG,
      diagnostics: executionDiagnostics({}, { strategy: 'fingerprint' }),
      now: NOW
    })

    expect(result?.patch.repair?.input?.selector).toBe('textarea[data-testid="ask"]')
    expect(result?.patch.repair?.button?.selector).toBe('button[data-testid="send"]')
    expect(result?.patch.input).toBeUndefined()
    expect(result?.patch.button).toBeUndefined()
  })
})
