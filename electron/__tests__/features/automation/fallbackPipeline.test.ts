/**
 * Regression tests for the injected fallback-resolution pipeline.
 *
 * Both cases below are real defects that shipped because the pipeline only
 * ever ran inside the fully assembled send script, where the failure mode was
 * indistinguishable from "the page never rendered the button".
 */
import { selectorEngine } from '@electron/features/automation/automationScripts/lib/selectorEngine'
import { selectorRepairRuntime } from '@electron/features/automation/automationScripts/lib/selectorRepairRuntime'
import { siteStrategyRuntime } from '@electron/features/automation/automationScripts/lib/siteStrategyRegistry'

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
      // Production-plausible confidence: the real trySemanticFallback refuses
      // anything below the medium threshold, and the hardened pipeline treats
      // a lone candidate scoring below the ambiguity gap as untrustworthy.
      // A stub score of 1 would describe a state the production code cannot
      // produce, so the stub reports a realistic high score here.
      const computeConfidenceScore = () => ({ level: 'high', score: 85 });
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

/**
 * 2026-10-17 ölçümü (canlı chatgpt.com): yeni composer'da
 *   - gönder düğmesi `data-composer-submit` taşıyor (data-testid yok),
 *   - composer boşken gönder düğmesi `hidden`, görünür tek yuvarlak düğme
 *     dikte (mic) düğmesi,
 *   - sayfada 7 adet `button[type="submit"]` var (6'sı diyalog "Kapat").
 *
 * trySemanticFallback, site stratejisinden ÖNCE çalışır ve bütün submit
 * düğmelerini toplayıp puanladığı için hem mikrofonu hem de bir diyaloğun
 * "Kapat" düğmesini gönder düğmesi seçebiliyordu.
 */
describe('trySemanticFallback button scoping', () => {
  type SemanticHarness = {
    trySemanticFallback: (
      kind: string,
      config?: unknown
    ) => { element: Element | null; matchedSelector?: string; strategy?: string } | null
  }

  /**
   * `buildCommonHelpers` sırasının aynısı: composer yardımcıları
   * siteStrategyRuntime'da, self-healing bloğu selectorRepairRuntime'da,
   * pipeline selectorEngine'in içinde. computeConfidenceScore sabit puan
   * verir, böylece hangi adayın seçildiği yalnızca pipeline'ın kendi
   * önceliklendirmesinden anlaşılır.
   */
  const buildHarness = () => `() => {
    const uniqueStrings = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
    const uniqueElements = (arr) => Array.from(new Set(arr));
    const now = () => Date.now();
    const roundMs = (v) => Math.round(v);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const CONFIDENCE_THRESHOLD_MEDIUM = 40;
    const CONFIDENCE_THRESHOLD_HIGH = 70;
    const getSearchRoots = () => [document];
    const getAutomationCache = () => ({ elements: {}, pageUrl: location.href });
    const isReadyForInteraction = (el) => !!el && el.isConnected;
    const computeConfidenceScore = () => ({ score: 50, level: 'medium' });
    const findUniqueSelectorMatch = () => ({ element: null, matchedSelector: null, strategy: 'none' });
    const findElementByFingerprint = () => null;
    const cacheElement = () => {};
    const getCachedElement = () => null;
    const invalidateCacheEntry = () => {};
    const tryChatGptComposerFallback = () => null;
    const tryGeminiComposerFallback = () => null;
    const tryGeminiButtonFallback = () => null;
    ${selectorRepairRuntime}
    ${siteStrategyRuntime}
    ${selectorEngine}
    return { trySemanticFallback }
  }`

  // Kayıtlı bir config olmadan __isLikelySendButton ikon-only düğmeleri
  // reddeder; gerçek üretimde pipeline yalnızca bir lookup ile çalıştığı için
  // hostChain'li bir config verilir.
  const config = {
    input: { selectors: ['#composer-input'], fingerprint: null },
    button: { selectors: ['#composer-submit'], fingerprint: { hostChain: ['#app-root'] } }
  }

  const getHarness = () => (window.eval(buildHarness()) as () => unknown)() as SemanticHarness

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('never returns a dictation (microphone) control as the send button', () => {
    for (const attribute of [
      'data-start-dictation',
      'data-cancel-dictation',
      'data-submit-dictation'
    ]) {
      document.body.innerHTML = `
        <form class="composer-form">
          <textarea></textarea>
          <button id="mic" type="submit" ${attribute} aria-label="Mikrofon">🎙</button>
          <button id="send" type="button" aria-label="Gönder">→</button>
        </form>
      `
      const result = getHarness().trySemanticFallback('button', config)
      expect(result, `${attribute} must not be resolved as the send button`).not.toBeNull()
      expect(result?.element, `${attribute} must not be resolved as the send button`).toBe(
        document.getElementById('send')
      )
    }
  })

  it('prefers the composer submit control over a page-wide submit button', () => {
    // Diyaloğun "Onayla" düğmesi DOM'da daha önce geliyor ve her iki aday da
    // aynı puanı alıyor; kapsamsız toplama ilk bulduğunu seçerdi.
    document.body.innerHTML = `
      <div role="dialog">
        <button id="dialog-submit" type="submit" aria-label="Onayla">Onayla</button>
      </div>
      <form class="composer-form">
        <textarea></textarea>
        <button id="composer-submit" type="submit" data-composer-submit
                aria-label="Mesaj gönder">→</button>
      </form>
    `
    const result = getHarness().trySemanticFallback('button', config)
    expect(result).not.toBeNull()
    expect(result?.element).toBe(document.getElementById('composer-submit'))
  })
})
