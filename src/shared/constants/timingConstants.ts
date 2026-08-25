/**
 * Shared timing constants for focus transfers and modal-transition defers.
 * Replaces inline `setTimeout` magic numbers (STD-017). Animation durations
 * themselves live in `src/shared/lib/motion.ts`.
 */

/** Defer before focusing an element that just mounted / became editable. */
export const FOCUS_DEFER_MS = 50

/** Defer before moving focus into an overlay that is still animating in. */
export const OVERLAY_FOCUS_TRANSFER_MS = 80

/** Defer before focusing a search input revealed by a toggle. */
export const SEARCH_INPUT_FOCUS_MS = 100

/**
 * Wait for a dialog/tab to finish its exit transition before triggering a
 * follow-up action (e.g. starting a tutorial behind closed settings).
 */
export const MODAL_EXIT_TRANSITION_MS = 300
