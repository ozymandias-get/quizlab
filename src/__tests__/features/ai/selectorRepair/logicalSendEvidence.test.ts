/**
 * Logical-send aggregation.
 *
 * The image pipeline performs several injected scripts for ONE user action
 * (focus, paste, refocus, prompt, submit-ready, click). Treating them as
 * independent observations was wrong in both directions:
 *
 *   - the orchestrator used to `return` after the first successful persist, so
 *     `promptScript` could persist the input recovery and swallow the
 *     `clickScript` button evidence entirely;
 *   - crediting every script would let one message advance the same locator
 *     twice and reach the promotion threshold off a single send.
 *
 * The rule enforced here: at most one observation per locator per logical send,
 * and the winner chosen by the canonical ordering rather than by arrival order.
 */
import type { AutomationSelectorDiagnostics } from '@shared-core/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { evaluateSelectorRepairEvidence } from '@features/ai/lib/selectorRepair/evaluateRepairEvidence'
import { aggregateLogicalSendEvidence } from '@features/ai/lib/selectorRepair/logicalSendEvidence'

import {
  createSendDiagnostics,
  healthyButtonDiagnostics,
  healthyInputDiagnostics,
  recoveredButtonDiagnostics,
  recoveredInputDiagnostics,
  scriptDiagnostics
} from './repairStore.test-helpers'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => null
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

const STALE_CONFIG = {
  version: 2 as const,
  input: '#gone',
  button: 'button#old',
  inputCandidates: ['#gone', 'textarea[data-testid="ask"]'],
  buttonCandidates: ['button#old'],
  inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
  buttonFingerprint: { tag: 'button', dataTestId: 'send' },
  health: 'ready' as const
}

const NOW = 1_700_000_000_000

function countOf(result: ReturnType<typeof evaluateSelectorRepairEvidence>): number {
  return result?.patch.repair?.input?.consecutiveSuccessCount ?? 0
}

describe('logical send evidence aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no operation script ran', () => {
    expect(
      aggregateLogicalSendEvidence(
        createSendDiagnostics({
          focusScript: scriptDiagnostics(healthyInputDiagnostics()),
          submitReadyScript: scriptDiagnostics(healthyInputDiagnostics())
        })
      )
    ).toBeNull()
  })

  it('G: keeps both the input and the button evidence from one image send', () => {
    // promptScript inserted text into a recovered input; clickScript clicked a
    // recovered send button. One logical send, two distinct locators.
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        pipeline: 'image',
        promptScript: scriptDiagnostics(recoveredInputDiagnostics()),
        clickScript: {
          ...scriptDiagnostics(healthyInputDiagnostics(), recoveredButtonDiagnostics()),
          kind: 'click_send'
        }
      })
    )

    expect(aggregated).not.toBeNull()
    expect(aggregated?.input?.strategy).toBe('candidate')
    expect(aggregated?.button?.strategy).toBe('fingerprint')

    const result = evaluateSelectorRepairEvidence({
      config: STALE_CONFIG,
      diagnostics: aggregated as NonNullable<typeof aggregated>,
      now: NOW
    })

    // Both locators learned; neither starved the other.
    expect(result?.patch.repair?.input?.consecutiveSuccessCount).toBe(1)
    expect(result?.patch.repair?.button?.consecutiveSuccessCount).toBe(1)
    expect(result?.patch.input).toBeUndefined()
    expect(result?.patch.button).toBeUndefined()
  })

  it('G2: the button still promotes on its own streak', () => {
    const staged = {
      ...STALE_CONFIG,
      repair: {
        button: {
          selector: 'button[data-testid="send"]',
          strategy: 'fingerprint' as const,
          confidenceScore: 110,
          confidenceLevel: 'high' as const,
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: 2,
          consecutiveSuccessCount: 2,
          sourceFingerprint: { tag: 'button', dataTestId: 'send' }
        }
      }
    }

    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        pipeline: 'image',
        promptScript: scriptDiagnostics(healthyInputDiagnostics()),
        clickScript: {
          ...scriptDiagnostics(healthyInputDiagnostics(), recoveredButtonDiagnostics()),
          kind: 'click_send'
        }
      })
    )

    const result = evaluateSelectorRepairEvidence({
      config: staged,
      diagnostics: aggregated as NonNullable<typeof aggregated>,
      now: NOW
    })

    expect(result?.promoted).toBe(true)
    expect(result?.patch.button).toBe('button[data-testid="send"]')
    expect(result?.patch.buttonCandidates).toEqual(['button[data-testid="send"]', 'button#old'])
  })

  it('H: credits a locator at most once per logical send', () => {
    // Three scripts all report the same recovered input. It must still be a
    // single observation.
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        pipeline: 'image',
        script: scriptDiagnostics(recoveredInputDiagnostics()),
        promptScript: scriptDiagnostics(recoveredInputDiagnostics()),
        clickScript: scriptDiagnostics(recoveredInputDiagnostics())
      })
    )

    const result = evaluateSelectorRepairEvidence({
      config: STALE_CONFIG,
      diagnostics: aggregated as NonNullable<typeof aggregated>,
      now: NOW
    })

    expect(countOf(result)).toBe(1)
  })

  it('H2: an ambiguous record never displaces a trustworthy one', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(recoveredInputDiagnostics()),
        promptScript: scriptDiagnostics(
          recoveredInputDiagnostics({
            ambiguous: true,
            repairEligible: false,
            repairReason: 'ambiguous_candidates'
          })
        )
      })
    )

    expect(aggregated?.input?.repairEligible).toBe(true)
    expect(aggregated?.input?.ambiguous).toBeFalsy()
  })

  it('H3: a blocklisted record never displaces a trustworthy one', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        promptScript: scriptDiagnostics(healthyInputDiagnostics(), recoveredButtonDiagnostics()),
        clickScript: scriptDiagnostics(
          healthyInputDiagnostics(),
          recoveredButtonDiagnostics({
            repairEligible: false,
            repairReason: 'blocked_send_control'
          })
        )
      })
    )

    expect(aggregated?.button?.repairReason).toBe('eligible')
  })

  it('prefers the lower-risk strategy when both records are usable', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(
          recoveredInputDiagnostics({
            strategy: 'semantic',
            stableSelector: 'textarea[aria-label="Ask"]'
          })
        ),
        promptScript: scriptDiagnostics(
          recoveredInputDiagnostics({
            strategy: 'candidate',
            stableSelector: 'textarea[data-testid="ask"]',
            confidenceScore: 95
          })
        )
      })
    )

    // candidate (saved candidate list) outranks semantic.
    expect(aggregated?.input?.strategy).toBe('candidate')
  })

  it('falls back to semantic when the candidate record is not usable', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(
          recoveredInputDiagnostics({
            strategy: 'candidate',
            unstableSelector: true,
            repairEligible: false,
            repairReason: 'unstable_selector'
          })
        ),
        promptScript: scriptDiagnostics(
          recoveredInputDiagnostics({
            strategy: 'semantic',
            stableSelector: 'textarea[aria-label="Ask"]'
          })
        )
      })
    )

    expect(aggregated?.input?.strategy).toBe('semantic')
  })

  it('prefers the higher confidence score within the same strategy', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(recoveredInputDiagnostics({ confidenceScore: 40 })),
        promptScript: scriptDiagnostics(recoveredInputDiagnostics({ confidenceScore: 120 }))
      })
    )

    expect(aggregated?.input?.confidenceScore).toBe(120)
  })

  it('is order independent: reversing the scripts picks the same evidence', () => {
    const inputA = recoveredInputDiagnostics({
      strategy: 'semantic',
      stableSelector: 'textarea[aria-label="Ask"]'
    })
    const inputB = recoveredInputDiagnostics({
      strategy: 'candidate',
      stableSelector: 'textarea[data-testid="ask"]'
    })

    const forward = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(inputA),
        promptScript: scriptDiagnostics(inputB)
      })
    )
    const reverse = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(inputB),
        promptScript: scriptDiagnostics(inputA)
      })
    )

    expect(forward?.input?.strategy).toBe(reverse?.input?.strategy)
    expect(forward?.input?.stableSelector).toBe(reverse?.input?.stableSelector)
  })

  it('does not treat a bare element lookup as a success', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(
          recoveredInputDiagnostics({ operationSucceeded: false }),
          recoveredButtonDiagnostics({ operationSucceeded: false })
        )
      })
    )

    const result = evaluateSelectorRepairEvidence({
      config: STALE_CONFIG,
      diagnostics: aggregated as NonNullable<typeof aggregated>,
      now: NOW
    })

    expect(result).toBeNull()
  })

  it('keeps a healthy button untouched when only the input recovered', () => {
    const aggregated = aggregateLogicalSendEvidence(
      createSendDiagnostics({
        script: scriptDiagnostics(recoveredInputDiagnostics(), healthyButtonDiagnostics())
      })
    )

    const result = evaluateSelectorRepairEvidence({
      config: STALE_CONFIG,
      diagnostics: aggregated as NonNullable<typeof aggregated>,
      now: NOW
    })

    expect(result?.reasons.input).toBe('eligible')
    expect(result?.reasons.button).toBe('not_recovered')
    expect(result?.patch.repair?.button ?? null).toBeNull()
  })
})

describe('toSelectorRepairEvidence defaults', () => {
  it('treats missing fields as refused rather than trusted', async () => {
    const { toSelectorRepairEvidence } =
      await import('@features/ai/lib/selectorRepair/logicalSendEvidence')
    const bare: AutomationSelectorDiagnostics = {
      requestedSelector: '#x',
      matchedSelector: '#x',
      strategy: 'fingerprint',
      durationMs: 0,
      waitIterations: 0,
      cacheHits: 0,
      cacheInvalidations: 0,
      interactiveRequired: false
    }

    const evidence = toSelectorRepairEvidence(bare)

    expect(evidence.confidenceLevel).toBe('low')
    expect(evidence.confidenceScore).toBe(0)
    expect(evidence.stableSelector).toBeNull()
    expect(evidence.operationSucceeded).toBe(false)
    expect(evidence.ambiguous).toBe(false)
  })
})
