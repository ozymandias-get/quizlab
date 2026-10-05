/**
 * Numeric policy thresholds for selector self-healing.
 *
 * Kept in their own module because they are the values that must never drift
 * between the three consumers of the policy: the injected view runtime
 * mirrors them into script constants, the renderer reads them before it writes
 * to disk, and the electron sanitizer re-checks them.
 */

/**
 * Consecutive *real* pipeline successes (text insertion for the input, a
 * successful submit/click for the button) required before a staged repair
 * candidate may be promoted to the primary selector. Both locators share the
 * threshold so a single constant governs the loop; the button additionally has
 * to clear the stricter stability gate in `isPromotableSelector`.
 */
export const SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD = 3

/**
 * Minimum score gap between the best and the runner-up recovery candidate.
 *
 * `computeConfidenceScore` in the injected runtime produces integer scores, and
 * two candidates only differ by their semantic / attribute signals. A 15-point
 * window is roughly one strong signal (fingerprint aria-label = 40, role = 20,
 * editable = 10), so anything closer is treated as "we cannot tell them apart"
 * and never auto-promoted. The runtime reports `ambiguous` when the gap is
 * below this value.
 */
export const MIN_AUTO_REPAIR_SCORE_GAP = 15

/**
 * Time window used for repair-loop (flapping) protection. Inside the window a
 * second, *different* selector may not be promoted for the same locator, which
 * stops `A → repair B → repair A → repair B` ping-pong. The window is
 * deliberately short: long-term drift of a site should still be repairable.
 */
export const REPAIR_FLAP_WINDOW_MS = 10 * 60 * 1000

/** Maximum number of candidates kept after a promotion (mirrors the sanitizer cap). */
export const MAX_REPAIR_CANDIDATE_COUNT = 12

/**
 * Bounded bonuses added on top of the canonical `computeConfidenceScore` when a
 * recovery is being scored *for persistence*.
 *
 * The base score is deliberately pessimistic because it also has to gate the
 * runtime fallback ("is this element good enough to click right now?"), where a
 * false accept is a wrong click. Two facts that the base score cannot see are
 * nevertheless strong evidence when the question is "is this selector good
 * enough to remember?":
 *
 *   - a stable, non-marker CSS selector could be re-derived for the element
 *     (the Magic Selector's own generator accepted it, generated ids/classes
 *     rejected);
 *   - the element already passed the runtime's interaction gate, i.e. it is
 *     visible, enabled and not aria-disabled.
 *
 * Both are objective, cheap and verifiable, and both are added with a hard cap
 * so the adjustment can never manufacture confidence out of nothing.
 */
export const REPAIR_SCORE_BONUS_STABLE_SELECTOR = 25
export const REPAIR_SCORE_BONUS_INTERACTIVE = 10
export const REPAIR_SCORE_BONUS_MAX =
  REPAIR_SCORE_BONUS_STABLE_SELECTOR + REPAIR_SCORE_BONUS_INTERACTIVE
