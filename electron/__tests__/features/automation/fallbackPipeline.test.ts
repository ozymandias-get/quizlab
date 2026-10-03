/**
 * Regression tests for the injected fallback-resolution pipeline.
 *
 * Both cases below are real defects that shipped because the pipeline only
 * ever ran inside the fully assembled send script, where the failure mode was
 * indistinguishable from "the page never rendered the button".
 */
import { selectorEngine } from '@electron/features/automation/automationScripts/lib/selectorEngine'

import { beforeEach, describe, expect, it } from 'vitest'

interface HarnessOptions {
  /** Milliseconds the (stubbed) semantic scan is assumed to take. */
  semanticCostMs?: number
  /**
   * Whether the stub target is discoverable by the semantic strategy. When
   * false the pipeline must fall through to the later strategies.
   */
  semanticMatch?: boolean
  /** Whether the last-resort heuristic resolves an element. */
  heuristicMatch?: boolean
}

/**
 * Evaluates the injected selector-engine source against stubbed collaborators so
 * the pipeline can be driven directly. `now` is a controllable clock, which is
 * what makes the per-strategy budget observable without real waiting.
 */
function buildHarness({
  semanticCostMs = 0,
  semanticMatch = true,
  heuristicMatch = false
}: HarnessOptions): string {
  // A <textarea> is one of the candidates trySemanticFallback collects; a bare
  // <div> is not, which forces the pipeline past the semantic strategy.
  const stubElement = semanticMatch
    ? "const target = document.createElement('textarea');"
    : "const target = document.createElement('div');"

  return `
    (async function () {
      const clock = { t: 0 };
      const heuristicCalls = { count: 0 };

      ${stubElement}
      target.id = 'stub-target';
      document.body.appendChild(target);

      const now = () => clock.t;
      const roundMs = (v) => Math.round(v);
      const wait = async () => { clock.t += 250; };
      const isAborted = () => false;

      const getSearchRoots = () => {
        // Simulate the cost of the real root scan so the per-strategy budget
        // can be exceeded deterministically.
        clock.t += ${semanticCostMs};
        return [document];
      };
      const uniqueElements = (list) => Array.from(new Set(list));
      const uniqueStrings = (list) => Array.from(new Set(list));
      const CONFIDENCE_THRESHOLD_MEDIUM = 0.5;
      const computeConfidenceScore = () => ({ level: 'high', score: 1 });
      const __isLikelySendButton = () => true;
      const __listApplicableStrategies = () => [];

      const heuristic = () => {
        heuristicCalls.count += 1;
        return ${heuristicMatch ? "{ element: target, matchedSelector: 'heuristic-fallback' }" : 'null'};
      };
      const tryChatGptComposerFallback = heuristic;
      const tryGeminiComposerFallback = heuristic;
      const tryGeminiButtonFallback = heuristic;

      // Never resolve through the selector/fingerprint paths: every resolution
      // in these tests must come from the fallback pipeline.
      const getCachedElement = () => null;
      const cacheElement = () => {};
      const invalidateCacheEntry = () => {};
      const findUniqueSelectorMatch = () => ({ element: null, matchedSelector: null });
      const findElementByFingerprint = () => ({ element: null, matchedSelector: null });
      const isReadyForInteraction = () => true;
      const __annotateSelectorResolution = (diagnostics) => diagnostics;

      ${selectorEngine}

      const diagnostics = {};
      const lookup = { selectors: ['#stub-missing'], fingerprint: null };

      const direct = runFallbackPipeline('input', null, diagnostics, 0);

      const resolveDiagnostics = {};
      const viaResolve = await resolveWithFallback(
        lookup, 'input', resolveDiagnostics, null, 2000, false
      );

      return {
        directStrategy: direct ? direct.strategy : null,
        directElementId: direct && direct.element ? direct.element.id : null,
        viaResolveStrategy: viaResolve.element ? viaResolve.strategy : null,
        viaResolveElementId: viaResolve.element ? viaResolve.element.id : null,
        fallbackAttempts: resolveDiagnostics.fallbackAttempts,
        heuristicCalls: heuristicCalls.count
      };
    })()
  `
}

describe('injected fallback pipeline', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
    delete (window as typeof window & { __quizlabSpaProbeInstalled?: unknown })
      .__quizlabSpaProbeInstalled
  })

  it('keeps an element resolved by a strategy that overran its per-step budget', async () => {
    // The semantic scan is made to take 600ms while __FALLBACK_STEP_TIMEOUT_MS
    // is 500ms. Before the fix the budget check lived in a `finally` block and
    // used `break`, an abrupt completion that overrides the step's pending
    // `return` — so the element was found and then thrown away.
    const result = await window.eval(buildHarness({ semanticCostMs: 600 }))

    expect(result.directStrategy).toBe('semantic')
    expect(result.directElementId).toBe('stub-target')
    expect(result.viaResolveStrategy).toBe('semantic')
    expect(result.viaResolveElementId).toBe('stub-target')
  })

  it('still resolves normally when strategies stay inside budget', async () => {
    const result = await window.eval(buildHarness({ semanticCostMs: 10 }))

    expect(result.directStrategy).toBe('semantic')
    expect(result.viaResolveStrategy).toBe('semantic')
  })

  it('stops starting further strategies once a step overruns its budget', async () => {
    // The budget guard is preserved: an overrunning step that resolves nothing
    // must end the pipeline instead of walking every remaining strategy.
    const result = await window.eval(
      buildHarness({ semanticCostMs: 600, semanticMatch: false, heuristicMatch: true })
    )

    expect(result.directStrategy).toBeNull()
    expect(result.heuristicCalls).toBe(0)
  })

  it('reaches the last-resort heuristic late in the retry window', async () => {
    // The heuristic is strategy index 3, so it only runs once the depth cursor
    // saturates at __MAX_FALLBACK_ATTEMPTS. An early "depth >= max" bail-out
    // made it unreachable for the whole 10s window.
    const result = await window.eval(buildHarness({ semanticMatch: false, heuristicMatch: true }))

    expect(result.viaResolveStrategy).toBe('heuristic')
    expect(result.viaResolveElementId).toBe('stub-target')
    // Depth saturates after three 250ms retries.
    expect(result.fallbackAttempts).toBe(3)
  })
})
