/**
 * Canonical self-healing policy (`shared/selectorRepair.ts`).
 *
 * This module is the single source of truth shared by the injected runtime, the
 * renderer and the electron sanitizer, so the tests here are the contract: the
 * thresholds, the confidence gate, the flapping guard and the promotion
 * bookkeeping are all pinned down once, in one place.
 */
import type { SelectorRepairCandidate } from '@shared-core/types/automation'

import { describe, expect, it } from 'vitest'

import {
  AUTOMATION_LOOKUP_STRATEGIES,
  advanceRepairCandidate,
  buildPromotedSelectors,
  buildRepairCandidateId,
  classifyRepairEligibility,
  CONFIDENCE_LEVELS,
  getLocatorSelectorKeys,
  isConfidenceLevel,
  isInternalMarkerSelector,
  isLookupStrategy,
  isPersistableSelector,
  isPromotionEligible,
  isProviderDerivedStrategy,
  isRecoveryStrategy,
  isRepairFlapping,
  isSameRepairCandidate,
  MAX_REPAIR_CANDIDATE_COUNT,
  MIN_AUTO_REPAIR_SCORE_GAP,
  normalizeConfidenceLevel,
  normalizeLookupStrategy,
  RECOVERY_LOOKUP_STRATEGIES,
  REPAIR_FLAP_WINDOW_MS,
  REPAIR_SCORE_BONUS_MAX,
  SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
} from '../../../shared/selectorRepair'

const NOW = 1_700_000_000_000

const ELIGIBLE_BASE = {
  kind: 'input' as const,
  strategy: 'candidate' as const,
  confidenceScore: 95,
  confidenceLevel: 'high' as const,
  stableSelector: 'textarea[data-testid="ask"]',
  ambiguous: false,
  unstableSelector: false,
  blockedSendControl: false,
  operationSucceeded: true
}

function buildCandidate(overrides: Partial<SelectorRepairCandidate> = {}): SelectorRepairCandidate {
  return {
    selector: 'textarea[data-testid="ask"]',
    strategy: 'candidate',
    confidenceScore: 95,
    confidenceLevel: 'high',
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    successCount: 1,
    consecutiveSuccessCount: 1,
    sourceFingerprint: null,
    ...overrides
  }
}

describe('lookup strategy union', () => {
  it('accepts every runtime strategy name', () => {
    for (const strategy of AUTOMATION_LOOKUP_STRATEGIES) {
      expect(isLookupStrategy(strategy)).toBe(true)
    }
  })

  it('rejects unknown strategy names', () => {
    expect(isLookupStrategy('telemetry')).toBe(false)
    expect(isLookupStrategy('siteStrategy')).toBe(false)
    expect(isLookupStrategy(42)).toBe(false)
    expect(normalizeLookupStrategy('direct')).toBe('direct')
    expect(normalizeLookupStrategy('nope')).toBeUndefined()
  })

  it('normalizes confidence levels', () => {
    for (const level of CONFIDENCE_LEVELS) {
      expect(isConfidenceLevel(level)).toBe(true)
      expect(normalizeConfidenceLevel(level)).toBe(level)
    }
    expect(normalizeConfidenceLevel('HIGH')).toBeUndefined()
    expect(normalizeConfidenceLevel(null)).toBeUndefined()
  })
})

describe('recovery classification', () => {
  it('treats only drifted-strategy signals as a recovery', () => {
    for (const strategy of RECOVERY_LOOKUP_STRATEGIES) {
      expect(isRecoveryStrategy(strategy)).toBe(true)
    }
    for (const strategy of ['cache', 'direct', 'recursive', 'none', undefined, 1]) {
      expect(isRecoveryStrategy(strategy)).toBe(false)
    }
  })

  it('ranks provider and heuristic strategies as the riskiest', () => {
    expect(isProviderDerivedStrategy('provider')).toBe(true)
    expect(isProviderDerivedStrategy('heuristic')).toBe(true)
    expect(isProviderDerivedStrategy('semantic')).toBe(false)
    expect(isProviderDerivedStrategy('fingerprint')).toBe(false)
  })
})

describe('persistable selectors', () => {
  it('accepts ordinary generated CSS selectors', () => {
    expect(isPersistableSelector('#composer')).toBe(true)
    expect(isPersistableSelector('textarea[aria-label="Send message"]')).toBe(true)
    expect(isPersistableSelector('button[role="button"].send-btn')).toBe(true)
  })

  it('rejects every runtime marker identifier', () => {
    for (const marker of [
      'fingerprint:descriptor',
      'text:send message',
      'semantic:auto',
      'provider:generic:input:textarea',
      'siteStrategy:builtin:gemini',
      'heuristic:gemini:composer-fallback',
      'gemini:button-fallback',
      'chatgpt:known-pattern',
      'generic:button:button',
      'builtin:gemini:input',
      '__internal:thing'
    ]) {
      expect(isInternalMarkerSelector(marker)).toBe(true)
      expect(isPersistableSelector(marker)).toBe(false)
    }
  })

  it('rejects empty, oversized and code-smuggling selectors', () => {
    expect(isPersistableSelector('')).toBe(false)
    expect(isPersistableSelector('   ')).toBe(false)
    expect(isPersistableSelector(null)).toBe(false)
    expect(isPersistableSelector(123)).toBe(false)
    expect(isPersistableSelector(`#${'a'.repeat(2001)}`)).toBe(false)
    expect(isPersistableSelector('#a}alert(1);{')).toBe(false)
    expect(isPersistableSelector('#a`x`')).toBe(false)
  })
})

describe('classifyRepairEligibility', () => {
  it('accepts a high-confidence recovery that really succeeded', () => {
    expect(classifyRepairEligibility(ELIGIBLE_BASE)).toEqual({
      eligible: true,
      reason: 'eligible'
    })
  })

  it('refuses when the operation did not really succeed', () => {
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, operationSucceeded: false }).reason).toBe(
      'operation_failed'
    )
  })

  it('refuses when the saved selector still works', () => {
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, strategy: 'direct' }).reason).toBe(
      'not_recovered'
    )
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, strategy: 'cache' }).reason).toBe(
      'not_recovered'
    )
  })

  it('refuses low and medium confidence without persisting anything', () => {
    expect(
      classifyRepairEligibility({ ...ELIGIBLE_BASE, confidenceLevel: 'low', confidenceScore: 20 })
        .reason
    ).toBe('low_confidence')
    expect(
      classifyRepairEligibility({
        ...ELIGIBLE_BASE,
        confidenceLevel: 'medium',
        confidenceScore: 60
      }).reason
    ).toBe('medium_confidence')
  })

  it('refuses an ambiguous recovery', () => {
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, ambiguous: true }).reason).toBe(
      'ambiguous_candidates'
    )
  })

  it('refuses an unstable (build-generated) selector', () => {
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, unstableSelector: true }).reason).toBe(
      'unstable_selector'
    )
  })

  it('refuses when no stable selector could be derived', () => {
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, stableSelector: null }).reason).toBe(
      'no_stable_selector'
    )
    expect(
      classifyRepairEligibility({ ...ELIGIBLE_BASE, stableSelector: 'fingerprint:descriptor' })
        .reason
    ).toBe('no_stable_selector')
  })

  it('refuses a blocklisted send control', () => {
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, blockedSendControl: true }).reason).toBe(
      'blocked_send_control'
    )
  })

  it('applies the stricter button rule to provider-derived strategies', () => {
    const buttonBase = { ...ELIGIBLE_BASE, kind: 'button' as const }
    // Input: a provider recovery may still be staged.
    expect(classifyRepairEligibility({ ...ELIGIBLE_BASE, strategy: 'provider' }).eligible).toBe(
      true
    )
    // Button: never promoted automatically.
    expect(classifyRepairEligibility({ ...buttonBase, strategy: 'provider' }).reason).toBe(
      'medium_confidence'
    )
    expect(classifyRepairEligibility({ ...buttonBase, strategy: 'heuristic' }).reason).toBe(
      'medium_confidence'
    )
    expect(classifyRepairEligibility({ ...buttonBase, strategy: 'semantic' }).eligible).toBe(true)
  })
})

describe('candidate identity', () => {
  it('is stable for the same selector, strategy and fingerprint', () => {
    const first = buildRepairCandidateId({
      selector: '#ask',
      strategy: 'semantic',
      fingerprint: { tag: 'textarea', role: 'textbox' }
    })
    const second = buildRepairCandidateId({
      selector: '#ask',
      strategy: 'semantic',
      fingerprint: { role: 'textbox', tag: 'textarea' }
    })
    expect(first).toBe(second)
  })

  it('changes when the strategy changes', () => {
    expect(buildRepairCandidateId({ selector: '#ask', strategy: 'semantic' })).not.toBe(
      buildRepairCandidateId({ selector: '#ask', strategy: 'fingerprint' })
    )
  })

  it('changes when the selector changes', () => {
    expect(buildRepairCandidateId({ selector: '#ask', strategy: 'semantic' })).not.toBe(
      buildRepairCandidateId({ selector: '#asker', strategy: 'semantic' })
    )
  })

  it('never hashes a raw DOM structure', () => {
    const withPath = buildRepairCandidateId({
      selector: '#ask',
      strategy: 'fingerprint',
      fingerprint: { tag: 'div', localPath: ['body > div > span'] }
    })
    const withOtherPath = buildRepairCandidateId({
      selector: '#ask',
      strategy: 'fingerprint',
      fingerprint: { tag: 'div', localPath: ['body > section > p'] }
    })
    // The identity ignores localPath so a layout change alone does not look
    // like a brand new recovery.
    expect(withPath).toBe(withOtherPath)
  })

  it('isSameRepairCandidate compares against a stored candidate', () => {
    const candidate = buildCandidate()
    const id = buildRepairCandidateId({
      selector: candidate.selector,
      strategy: candidate.strategy
    })
    expect(isSameRepairCandidate(candidate, id)).toBe(true)
    expect(isSameRepairCandidate(null, id)).toBe(false)
  })
})

describe('advanceRepairCandidate', () => {
  const candidateId = buildRepairCandidateId({
    selector: 'textarea[data-testid="ask"]',
    strategy: 'candidate'
  })

  it('starts a new candidate at one success', () => {
    const result = advanceRepairCandidate({
      previous: null,
      candidateId,
      selector: 'textarea[data-testid="ask"]',
      strategy: 'candidate',
      confidenceScore: 95,
      confidenceLevel: 'high',
      now: NOW
    })
    expect(result.identityChanged).toBe(true)
    expect(result.candidate.successCount).toBe(1)
    expect(result.candidate.consecutiveSuccessCount).toBe(1)
    expect(result.candidate.firstSeenAt).toBe(NOW)
  })

  it('grows both counters while the identity is unchanged', () => {
    const previous = buildCandidate({ successCount: 2, consecutiveSuccessCount: 2 })
    const result = advanceRepairCandidate({
      previous,
      candidateId,
      selector: 'textarea[data-testid="ask"]',
      strategy: 'candidate',
      confidenceScore: 95,
      confidenceLevel: 'high',
      now: NOW + 1000
    })
    expect(result.identityChanged).toBe(false)
    expect(result.candidate.successCount).toBe(3)
    expect(result.candidate.consecutiveSuccessCount).toBe(3)
    // firstSeenAt is preserved so the record keeps its original observation.
    expect(result.candidate.firstSeenAt).toBe(NOW)
    expect(result.candidate.lastSeenAt).toBe(NOW + 1000)
  })

  it('resets the consecutive counter when the candidate changes', () => {
    const previous = buildCandidate({ successCount: 2, consecutiveSuccessCount: 2 })
    const result = advanceRepairCandidate({
      previous,
      candidateId: buildRepairCandidateId({ selector: '#other', strategy: 'semantic' }),
      selector: '#other',
      strategy: 'semantic',
      confidenceScore: 95,
      confidenceLevel: 'high',
      now: NOW + 2000
    })
    expect(result.identityChanged).toBe(true)
    expect(result.candidate.successCount).toBe(1)
    expect(result.candidate.consecutiveSuccessCount).toBe(1)
    expect(result.candidate.selector).toBe('#other')
  })
})

describe('isPromotionEligible', () => {
  it('requires the shared consecutive success threshold', () => {
    for (const count of [1, SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD - 1]) {
      expect(isPromotionEligible(buildCandidate({ consecutiveSuccessCount: count }), 'input')).toBe(
        false
      )
    }
    expect(
      isPromotionEligible(
        buildCandidate({ consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD }),
        'input'
      )
    ).toBe(true)
  })

  it('never promotes below high confidence', () => {
    expect(
      isPromotionEligible(
        buildCandidate({
          confidenceLevel: 'medium',
          consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
        }),
        'input'
      )
    ).toBe(false)
  })

  it('never promotes a marker selector', () => {
    expect(
      isPromotionEligible(
        buildCandidate({
          selector: 'gemini:button-fallback',
          consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
        }),
        'button'
      )
    ).toBe(false)
  })

  it('never promotes a provider-derived button', () => {
    expect(
      isPromotionEligible(
        buildCandidate({
          strategy: 'heuristic',
          consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
        }),
        'button'
      )
    ).toBe(false)
    expect(
      isPromotionEligible(
        buildCandidate({
          strategy: 'heuristic',
          consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD
        }),
        'input'
      )
    ).toBe(true)
  })

  it('refuses a missing candidate', () => {
    expect(isPromotionEligible(null, 'input')).toBe(false)
    expect(isPromotionEligible(buildCandidate({ selector: null }), 'input')).toBe(false)
  })
})

describe('isRepairFlapping', () => {
  const lastRepair = {
    repairedAt: NOW,
    inputSelector: '#new-primary',
    buttonSelector: null
  }

  it('blocks a different selector inside the flap window', () => {
    expect(
      isRepairFlapping({
        lastRepair,
        kind: 'input',
        candidateSelector: '#another',
        now: NOW + 1000
      })
    ).toBe(true)
  })

  it('stays idempotent for the selector it just promoted', () => {
    expect(
      isRepairFlapping({
        lastRepair,
        kind: 'input',
        candidateSelector: '#new-primary',
        now: NOW + 1000
      })
    ).toBe(false)
  })

  it('allows a different selector once the window elapsed', () => {
    expect(
      isRepairFlapping({
        lastRepair,
        kind: 'input',
        candidateSelector: '#another',
        now: NOW + REPAIR_FLAP_WINDOW_MS + 1
      })
    ).toBe(false)
  })

  it('does not block the other locator kind', () => {
    expect(
      isRepairFlapping({ lastRepair, kind: 'button', candidateSelector: '#x', now: NOW })
    ).toBe(false)
  })

  it('does not block without any prior repair', () => {
    expect(
      isRepairFlapping({ lastRepair: null, kind: 'input', candidateSelector: '#x', now: NOW })
    ).toBe(false)
  })
})

describe('buildPromotedSelectors', () => {
  it('keeps the old primary as the first fallback instead of deleting it', () => {
    const result = buildPromotedSelectors({
      currentPrimary: '#old',
      currentCandidates: ['#old', '#older'],
      repairSelector: '#new'
    })
    expect(result.primary).toBe('#new')
    expect(result.candidates).toEqual(['#new', '#old', '#older'])
  })

  it('never duplicates the primary inside the candidate list', () => {
    const result = buildPromotedSelectors({
      currentPrimary: '#old',
      currentCandidates: ['#new', '#old'],
      repairSelector: '#new'
    })
    expect(result.primary).toBe('#new')
    expect(result.candidates).toEqual(['#new', '#old'])
  })

  it('respects the candidate count cap', () => {
    const many = Array.from({ length: 30 }, (_, i) => `#c${i}`)
    const result = buildPromotedSelectors({
      currentPrimary: '#old',
      currentCandidates: many,
      repairSelector: '#new'
    })
    expect(result.candidates).toHaveLength(MAX_REPAIR_CANDIDATE_COUNT)
    expect(result.candidates[0]).toBe('#new')
    expect(result.primary).toBe('#new')
  })

  it('tolerates missing and blank entries', () => {
    const result = buildPromotedSelectors({
      currentPrimary: null,
      currentCandidates: null,
      repairSelector: '#new'
    })
    expect(result.primary).toBe('#new')
    expect(result.candidates).toEqual(['#new'])
  })

  it('honours an explicit cap', () => {
    const result = buildPromotedSelectors({
      currentPrimary: '#old',
      currentCandidates: ['#a', '#b', '#c'],
      repairSelector: '#new',
      maxCount: 2
    })
    expect(result.primary).toBe('#new')
    expect(result.candidates).toEqual(['#new', '#old'])
  })
})

describe('policy constants', () => {
  it('keeps a single documented promotion threshold', () => {
    expect(SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD).toBe(3)
  })

  it('keeps a single documented ambiguity gap', () => {
    expect(MIN_AUTO_REPAIR_SCORE_GAP).toBe(15)
  })

  it('bounds the repair score bonus', () => {
    expect(REPAIR_SCORE_BONUS_MAX).toBe(35)
  })

  it('maps each locator kind to its own config keys', () => {
    expect(getLocatorSelectorKeys('input')).toEqual({
      primary: 'input',
      candidates: 'inputCandidates'
    })
    expect(getLocatorSelectorKeys('button')).toEqual({
      primary: 'button',
      candidates: 'buttonCandidates'
    })
  })
})
