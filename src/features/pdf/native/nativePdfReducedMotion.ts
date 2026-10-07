/**
 * One reader of the OS motion preference, for the native viewer's own surfaces.
 *
 * ## Why it exists
 *
 * `prefers-reduced-motion` is not a single switch in this codebase: the search
 * overlay reads it once per query, the shared stylesheet answers it with the
 * `motion-ok` / `motion-not` variants, and the `motion` components read it through
 * `useReducedMotion()`. The native viewer needed a fourth reader, and duplicating a
 * media query behind a feature flag four times is how four answers to one question
 * drift apart.
 *
 * ## Read at the moment it is needed, never cached
 *
 * The same rule `useNativePdfSearch` documents: a module-level cache would be a
 * stale-read hazard, because the user can change the setting while the app is open
 * and a cached answer would silently keep the old one. A page transition reads this
 * once per navigation, so there is nothing to save.
 *
 * ## A missing API means "no preference", not a crash
 *
 * `matchMedia` is feature-detected. A non-browser host — and jsdom without the
 * `src/__tests__/setup.ts` stub — has no `window.matchMedia` at all, and the
 * absence of the API is not a request for reduced motion.
 */

/**
 * Whether the user asked the OS for reduced motion.
 *
 * Safe on any host: no `window`, no `matchMedia`, and a media-query layer that
 * throws all resolve to `false`, which is the "animate normally" answer every
 * animation in this project falls back to.
 */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
