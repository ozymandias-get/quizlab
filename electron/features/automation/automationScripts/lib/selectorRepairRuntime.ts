/**
 * Selector self-healing — injected runtime evidence.
 *
 * This block is concatenated into every automation script and turns a raw
 * resolution (`element + matchedSelector + strategy`) into a *serializable*
 * repair verdict. No `Element` ever leaves the page: only numbers, strategy
 * names and candidate CSS strings travel back over IPC.
 *
 * The decision policy itself lives in `shared/selectorRepair.ts` (cross-process,
 * unit-tested). The constants below are the runtime mirror of it, and
 * `electron/__tests__/features/automation/selectorRepairRuntime.test.ts`
 * contains a parity test that keeps the two in sync.
 *
 * Responsibilities:
 *   1. Decide whether a resolution counts as a *recovery* (saved selector stale).
 *   2. Re-derive a stable CSS selector for the recovered element by reusing the
 *      Magic Selector's own `buildCssCandidates`.
 *   3. Refuse to produce evidence for anything ambiguous, blocklisted or
 *      structurally fragile (generated CSS-in-JS class, nth-child path).
 *   4. Mark a recovery as *used* only after the real pipeline step succeeded.
 */
import {
  REPAIR_SCORE_BONUS_INTERACTIVE,
  REPAIR_SCORE_BONUS_MAX,
  REPAIR_SCORE_BONUS_STABLE_SELECTOR
} from '../../../../../shared/selectorRepair/index.js'
import { buildInjectedStableSelectorHelper } from '../../lib/injectedPickerDom.js'

/** Mirrors `SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD` in shared/selectorRepair.ts. */
const PROMOTION_SUCCESS_THRESHOLD = 3

/** Mirrors `MIN_AUTO_REPAIR_SCORE_GAP` in shared/selectorRepair.ts. */
const MIN_AUTO_REPAIR_SCORE_GAP = 15

/**
 * Button auto-repair is strictly more conservative than input auto-repair:
 * a wrong send button is the most dangerous failure mode (it can silently
 * discard a draft, or submit into the wrong conversation), so a recovered
 * button must resolve through a selector at least as stable as a named
 * attribute instead of merely "some class".
 *
 * Mirrors `__SELECTOR_PRIORITY.name` from the injected selector engine.
 */
const BUTTON_MIN_SELECTOR_PRIORITY = 60

/** Minimum selector priority for an input auto-repair. Mirrors `tagClass` (25). */
const INPUT_MIN_SELECTOR_PRIORITY = 25

const INTERNAL_SELECTOR_MARKER =
  /^(?:fingerprint|text|semantic|provider|siteStrategy|heuristic|gemini|chatgpt|generic|builtin|config|__)[a-zA-Z]*:/i

/**
 * Build-generated class names (CSS-in-JS, atomic CSS, hashed build output).
 * They survive `SAFE_CLASS_TOKEN_REGEX` but change on every build, so a
 * selector built on them must never become a permanent primary selector.
 */
const GENERATED_CLASS_TOKEN =
  /^(?:css|sc|jsx|jss|emotion|styled|tw|atomic)-[a-z0-9]{4,}$|^[a-z]{1,4}-[a-z0-9]{5,}$|^[a-z]+[_-][a-f0-9]{6,}$/i

export const selectorRepairRuntime =
  `    const REPAIR_PROMOTION_SUCCESS_THRESHOLD = ${PROMOTION_SUCCESS_THRESHOLD};
    const REPAIR_MIN_AUTO_REPAIR_SCORE_GAP = ${MIN_AUTO_REPAIR_SCORE_GAP};
    const REPAIR_BUTTON_MIN_SELECTOR_PRIORITY = ${BUTTON_MIN_SELECTOR_PRIORITY};
    const REPAIR_INPUT_MIN_SELECTOR_PRIORITY = ${INPUT_MIN_SELECTOR_PRIORITY};
    const REPAIR_SCORE_BONUS_STABLE_SELECTOR = ${REPAIR_SCORE_BONUS_STABLE_SELECTOR};
    const REPAIR_SCORE_BONUS_INTERACTIVE = ${REPAIR_SCORE_BONUS_INTERACTIVE};
    const REPAIR_SCORE_BONUS_MAX = ${REPAIR_SCORE_BONUS_MAX};
    const REPAIR_INTERNAL_SELECTOR_MARKER = ${INTERNAL_SELECTOR_MARKER.toString()};
    const REPAIR_GENERATED_CLASS_TOKEN = ${GENERATED_CLASS_TOKEN.toString()};

    /**
     * Send-control blocklist, hoisted to runtime scope so the semantic fallback
     * (which selects a button to *click*) and the self-healing evidence (which
     * decides whether a button may be *persisted*) apply the exact same rule.
     * Cloning a second list here would let the two drift and is the failure
     * mode this block exists to prevent.
     */
    const SEND_LABEL_BLOCKLIST = [
        /(^|\\s|-|_)(new|newchat|new-chat|new_chat|newconversation|new-conversation)(\\s|-|_|$)/i,
        /(^|\\s|-|_)(close|sidebar|menu|settings|options|model|picker|theme|dark|light|logout|sign[-_ ]?out|profile|account)(\\s|-|_|$)/i,
        /(^|\\s|-|_)(attach|upload|file|image|emoji|gif|mic|microphone|voice|speak|stop|pause|cancel|clear|delete|edit|copy|share|bookmark|pin|archive|more)(button|btn)?(\\s|-|_|$)/i,
        /^(nav|header|aside|footer|sidebar)/i
    ];

    const __isBlockedSendLabel = (text) => {
        const value = String(text || '').toLowerCase().trim();
        for (let i = 0; i < SEND_LABEL_BLOCKLIST.length; i++) {
            if (SEND_LABEL_BLOCKLIST[i].test(value)) return true;
        }
        return false;
    };

    /**
     * Conservative "is this plausibly the Send control?" test used to reject
     * nav/utility buttons before scoring. \`lookup\` supplies the saved
     * fingerprint's host chain, which is the only accepted evidence for a
     * send button that carries no text of its own (icon-only buttons).
     */
    const __isLikelySendButton = (el, lookup) => {
        if (!el || el.disabled) return false;
        const text = String(
            (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) ||
            el.innerText || el.textContent || ''
        ).toLowerCase().trim();

        if (text && __isBlockedSendLabel(text)) return false;
        if (/\\b(send|g(ö|o)nder|submit|env(í|i)ar|envoyer|senden)\\b/i.test(text)) return true;
        if (!text) {
            try {
                const inForm = el.closest && el.closest('form, [role="form"]');
                const hasHostChain = Boolean(
                    lookup && lookup.fingerprint && lookup.fingerprint.hostChain &&
                    lookup.fingerprint.hostChain.length
                );
                return Boolean(inForm && hasHostChain);
            } catch (_) {
                return false;
            }
        }
        try {
            const inForm = el.closest && el.closest('form, [role="form"]');
            const hasHostChain = Boolean(
                lookup && lookup.fingerprint && lookup.fingerprint.hostChain &&
                lookup.fingerprint.hostChain.length
            );
            return Boolean(inForm && hasHostChain);
        } catch (_) {
            return false;
        }
    };

    /**
     * Strategies that mean the saved selector no longer describes the page.
     *
     * 'candidate' is included because a hit on a *non-primary* entry of the
     * saved candidate list is exactly the "primary drifted, a fallback carried
     * us" case. Cache hits are excluded on purpose: they carry the recovered
     * element forward, and their repair evidence is replayed from the cache
     * entry instead.
     */
    const REPAIR_RECOVERY_STRATEGIES = ['candidate', 'fingerprint', 'semantic', 'provider', 'siteStrategy', 'heuristic'];

    /** True when a matched selector is a runtime marker instead of CSS. */
    const __isInternalMarkerSelector = (selector) => {
        if (typeof selector !== 'string') return true;
        const trimmed = selector.trim();
        if (!trimmed) return true;
        return REPAIR_INTERNAL_SELECTOR_MARKER.test(trimmed);
    };

    const __isRecoveryStrategy = (strategy) => {
        return REPAIR_RECOVERY_STRATEGIES.indexOf(String(strategy)) >= 0;
    };

    const __isProviderDerivedStrategy = (strategy) => {
        return strategy === 'provider' || strategy === 'siteStrategy' || strategy === 'heuristic';
    };

    /** Mirrors the CONFIDENCE_THRESHOLD_* pair in confidenceScoring. */
    const __toConfidenceLevel = (score) => {
        if (score >= CONFIDENCE_THRESHOLD_HIGH) return 'high';
        if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return 'medium';
        return 'low';
    };

    /**
     * Re-derives a stable CSS selector for a recovered element using the very
     * same generator the Magic Selector persists, so a repair can never be
     * built on a class/id the picker would have rejected.
     */
    const __buildStableSelector = (element, kind) => {
        if (!element) return null;
        try {
            const bundle = buildCssCandidates(element, kind === 'button' ? 'button' : 'input');
            if (!bundle || bundle.length === 0) return null;
            for (let i = 0; i < bundle.length; i++) {
                const candidate = bundle[i];
                if (!__isInternalMarkerSelector(candidate)) return candidate;
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    /** True when the selector leans on a build-generated class token. */
    const __isGeneratedClassSelector = (selector) => {
        if (typeof selector !== 'string' || !selector) return false;
        if (/\\[[^\\]]*class[^\\]]*=/.test(selector)) return true;
        const matches = selector.match(/\\.([A-Za-z_][\\w-]*)/g);
        if (!matches) return false;
        for (let i = 0; i < matches.length; i++) {
            const token = matches[i].slice(1);
            if (REPAIR_GENERATED_CLASS_TOKEN.test(token)) return true;
        }
        return false;
    };

    /**
     * Serializable snapshot of a recovery's repair fields.
     *
     * Two jobs:
     *   - returned to the cache so a warm-cache hit can still count as another
     *     real usage of the same recovery;
     *   - the only shape that ever crosses the IPC boundary (no Element).
     */
    const __snapshotRepairEvidence = (diagnostics, strategy) => {
        if (!diagnostics || diagnostics.recovered !== true) return null;
        return {
            strategy: String(strategy || diagnostics.strategy || 'none'),
            confidenceScore: typeof diagnostics.confidenceScore === 'number'
                ? diagnostics.confidenceScore
                : 0,
            confidenceLevel: diagnostics.confidenceLevel || 'low',
            stableSelector: diagnostics.stableSelector || null,
            ambiguous: diagnostics.ambiguous === true,
            unstableSelector: diagnostics.unstableSelector === true,
            repairEligible: diagnostics.repairEligible === true,
            repairReason: diagnostics.repairReason || 'not_recovered'
        };
    };

    /**
     * Annotates a resolved element with repair evidence.
     *
     * Deliberately only runs for recoveries: a direct/cached primary hit is the
     * common case and must stay a pure fast path (no getComputedStyle, no
     * selector generation) so self-healing costs nothing when nothing drifted.
     */
    const __annotateSelectorResolution = (diagnostics, kind, result, config) => {
        if (!diagnostics || !result || !result.element) return null;
        const strategy = String(result.strategy || 'none');
        const recovered = __isRecoveryStrategy(strategy);
        diagnostics.recovered = recovered;

        if (!recovered) {
            diagnostics.repairEligible = false;
            diagnostics.repairReason = 'not_recovered';
            return null;
        }

        const base = computeConfidenceScore(
            { element: result.element, matchedSelector: result.matchedSelector },
            kind,
            config
        );

        const stableSelector = __buildStableSelector(result.element, kind);
        const interactive = isReadyForInteraction(result.element);

        // Bounded adjustment on top of the canonical score; see
        // REPAIR_SCORE_BONUS_* in shared/selectorRepair.ts for the rationale.
        let bonus = 0;
        if (stableSelector) bonus += REPAIR_SCORE_BONUS_STABLE_SELECTOR;
        if (interactive) bonus += REPAIR_SCORE_BONUS_INTERACTIVE;
        if (bonus > REPAIR_SCORE_BONUS_MAX) bonus = REPAIR_SCORE_BONUS_MAX;

        const confidence = {
            score: base.score + bonus,
            level: __toConfidenceLevel(base.score + bonus)
        };
        diagnostics.confidenceScore = confidence.score;
        diagnostics.confidenceLevel = confidence.level;

        const priority = typeof __selectorPriority === 'function'
            ? __selectorPriority(stableSelector || '')
            : 0;
        const requiredPriority = kind === 'button'
            ? REPAIR_BUTTON_MIN_SELECTOR_PRIORITY
            : REPAIR_INPUT_MIN_SELECTOR_PRIORITY;

        const unstable = __isGeneratedClassSelector(stableSelector);
        diagnostics.unstableSelector = unstable;

        let reason = 'eligible';
        if (!stableSelector) {
            reason = 'no_stable_selector';
        } else if (typeof result.scoreGap === 'number' && result.scoreGap < REPAIR_MIN_AUTO_REPAIR_SCORE_GAP) {
            diagnostics.ambiguous = true;
            reason = 'ambiguous_candidates';
        } else if (unstable) {
            reason = 'unstable_selector';
        } else if (priority < requiredPriority) {
            reason = 'no_stable_selector';
        } else if (kind === 'button' && !__isLikelySendButton(result.element, config && config.button)) {
            reason = 'blocked_send_control';
        } else if (confidence.level === 'low') {
            reason = 'low_confidence';
        } else if (confidence.level === 'medium') {
            reason = 'medium_confidence';
        } else if (kind === 'button' && __isProviderDerivedStrategy(strategy)) {
            reason = 'medium_confidence';
        }

        diagnostics.repairEligible = reason === 'eligible';
        diagnostics.repairReason = reason;
        diagnostics.stableSelector = diagnostics.repairEligible ? stableSelector : null;
        return __snapshotRepairEvidence(diagnostics, strategy);
    };

    /**
     * Marks a recovery as *observed in real usage*. Called by the generators
     * only after the pipeline step genuinely succeeded — text insertion for the
     * input, a successful submit/click for the button. A validation run or a
     * bare element lookup is deliberately not enough.
     */
    const __finalizeSelectorRepair = (diagnostics, kind, operationSucceeded) => {
        if (!diagnostics) return null;
        diagnostics.operationSucceeded = operationSucceeded === true;
        if (diagnostics.operationSucceeded && diagnostics.recovered === true) {
            return {
                strategy: diagnostics.strategy,
                confidenceScore: diagnostics.confidenceScore,
                confidenceLevel: diagnostics.confidenceLevel,
                stableSelector: diagnostics.stableSelector,
                reason: diagnostics.repairReason
            };
        }
        if (diagnostics.recovered === true && !diagnostics.operationSucceeded) {
            diagnostics.repairEligible = false;
            diagnostics.repairReason = 'operation_failed';
        }
        return null;
    };
` + buildInjectedStableSelectorHelper()

/** Exposed for the parity test; mirrors the injected `REPAIR_*` constants. */
export const selectorRepairRuntimeConstants = {
  PROMOTION_SUCCESS_THRESHOLD,
  MIN_AUTO_REPAIR_SCORE_GAP,
  BUTTON_MIN_SELECTOR_PRIORITY,
  INPUT_MIN_SELECTOR_PRIORITY
} as const
