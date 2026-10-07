/**
 * The page turn's presentation: a short, directional, compositor-only settle.
 *
 * ## What this is
 *
 * QuizLab's native viewer shows one page at a time, and swapping `currentPage` replaced
 * the pixels outright. This module is the whole of what was added on top of that:
 * a `transform`/`opacity` ramp on the page stack, in the direction the reader actually
 * turned. Nothing else about navigation moved.
 *
 * ## Deliberately small
 *
 * Eight pixels, 5 % of opacity and 140 ms. The bar was "the page change feels more
 * considered", not "the page change is an event", because this is a working PDF reader: a
 * reader who is on page 400 of a textbook is turning pages faster than any transition can
 * be appreciated, and anything slower taxes the render that is happening at the same time.
 * There is no scale, no blur, no shadow animation, no rotation, no perspective, no
 * overshoot and no spring — each of those was rejected for making text briefly harder to
 * read, which is the one thing a reader cannot afford.
 *
 * The opacity ramp is the smallest of the three on purpose, and the reason is structural
 * rather than aesthetic: the four layers do not finish together. See
 * `NATIVE_PAGE_TRANSITION_START_OPACITY`.
 *
 * ## Why `transform` and `opacity`, and nothing else
 *
 * Those are the two properties a compositor can animate without asking layout for a new
 * box, so a turn costs no reflow. `top`, `left`, `width`, `height`, `margin`, `padding`,
 * `filter` and `box-shadow` would each turn a 140 ms decoration into a layout or paint
 * pass over the largest element in the window.
 *
 * No `will-change` is declared. Chromium promotes an element for the lifetime of an
 * active animation on a composited property and drops the layer afterwards; a permanent
 * `will-change` would instead hold a full-page GPU texture for the entire session, which
 * is the opposite of what this phase is for.
 *
 * ## Why the animation is started imperatively instead of from a stylesheet
 *
 * A CSS `transition` needs two committed values, and the page box has only one: it is
 * mounted once and its identity changes underneath it. React's way of replaying an
 * entrance on a persistent element is a `key` change, and a `key` change on the page box
 * would remount the `<canvas>` inside it — a fresh canvas, a fresh `getPage` and a fresh
 * render on every page turn, which is precisely the cost this phase refuses to pay.
 * A CSS `animation` avoids the remount but only replays when `animation-name` changes,
 * and two consecutive forward turns have the same direction.
 *
 * `Element.animate()` is the platform's own "present this element now": it attaches a new
 * animation to the *existing* node, replays deterministically on every call, and the
 * browser keeps it off the main thread. The cost is that WAAPI timing options are not
 * CSS property values, so `var(--ease-glass)` cannot be substituted into them — the two
 * constants below are therefore hand-mirrored from the tokens in
 * `src/shared/styles/index.css`, and the duration uses `DURATION` from
 * `@shared/lib/motion`, which is the sanctioned JS mirror of the `--duration-*` scale.
 */
import { DURATION } from '@shared/lib/motion'

/**
 * Which way the reader turned.
 *
 * Derived from the page numbers, never from the input device: a wheel gesture, a toolbar
 * button and an internal PDF link all end at the same setter, and only the page numbers
 * are common to all of them.
 */
export type NativePdfPageTransitionDirection = 'forward' | 'backward'

/**
 * How far the page stack starts from its resting position, in pixels.
 *
 * Small on purpose. At this distance the movement reads as the page settling into place
 * rather than as a slide, and 8 px is under the height of one line of body text, so a
 * reader mid-sentence does not have to re-find their place.
 */
export const NATIVE_PAGE_TRANSITION_OFFSET_PX = 8

/**
 * Where the opacity ramp starts.
 *
 * A *shallow* ramp, and the reason is layer skew rather than taste.
 *
 * The canvas commits first: `useNativePdfRender` fires `onRenderCommitted` as soon as
 * the pixels are in the canvas, while the text layer and the annotation layer are still
 * one to three async steps behind it (their own `getPage`, `getTextContent()`,
 * `getAnnotations()`, then their own render). The page box is the parent of all four, so
 * a deep opacity ramp does not fade the page in as a unit — it fades in a canvas alone
 * and then lets the words arrive onto an already-dimmed page. That is the flicker this
 * constant exists to prevent, and it is why the floor is 0.95 rather than something
 * halfway: at 5 % the missing text layer is imperceptible and the ramp is read as the
 * page settling, whereas at 0.55 the interim state is plainly visible and reads as a
 * blink.
 *
 * It is a floor and not 1 either, because a transition that only translates reads as a
 * scroll glitch rather than a page turn. The two together — 8 px of travel and a 5 %
 * dim — carry the direction without ever making body text unreadable.
 *
 * Note that this is *not* the same as animating the outgoing pixels: the animation only
 * starts once the new page has committed (see `useNativePdfPageTransition`), so the
 * outgoing pixels are never dimmed.
 */
export const NATIVE_PAGE_TRANSITION_START_OPACITY = 0.95

/**
 * `--duration-normal`, the same 140 ms the dialogs, menus and search bar use.
 *
 * Rounded because `DURATION.normal * 1000` is not exactly 140 in binary floating point,
 * and a duration that reads as `140.00000000000003` in a test is a smell.
 */
export const NATIVE_PAGE_TRANSITION_DURATION_MS = Math.round(DURATION.normal * 1000)

/**
 * `--ease-glass`, the project's single easing token, in the form WAAPI accepts.
 *
 * Front-loaded: the page is most of the way home in the first third of the ramp, which is
 * what makes 140 ms read as "settling" instead of "slow".
 */
export const NATIVE_PAGE_TRANSITION_EASING = 'cubic-bezier(0.2, 0.9, 0.22, 1)'

/**
 * The direction a turn went, or `null` when the page did not actually change.
 *
 * A page *number* comparison is the whole rule. It is deliberately not a step count: an
 * internal link from page 5 to page 32 is one forward turn, not twenty-seven forward
 * turns, and a jump is presented exactly like a single wheel tick.
 */
export function deriveNativePdfPageTransitionDirection(
  previousPage: number,
  nextPage: number
): NativePdfPageTransitionDirection | null {
  if (nextPage === previousPage) return null
  return nextPage > previousPage ? 'forward' : 'backward'
}

/**
 * The two keyframes a page turn animates between.
 *
 * Forward enters from below and backward from above, so the page appears to be moving in
 * the direction the reader asked for. The final keyframe is the page box's *resting*
 * style (`opacity: 1`, no transform), which is what lets the animation be created with
 * `fill: 'none'` and leave nothing behind when it ends.
 */
export function nativePdfPageTransitionKeyframes(
  direction: NativePdfPageTransitionDirection
): Keyframe[] {
  const from =
    direction === 'forward'
      ? `translateY(${NATIVE_PAGE_TRANSITION_OFFSET_PX}px)`
      : `translateY(-${NATIVE_PAGE_TRANSITION_OFFSET_PX}px)`
  return [
    { opacity: NATIVE_PAGE_TRANSITION_START_OPACITY, transform: from },
    { opacity: 1, transform: 'translateY(0px)' }
  ]
}

/**
 * Present a page turn on `page`.
 *
 * Returns the running animation so the caller can supersede it, or `null` when there is
 * nothing to show. `null` is a legitimate answer in two cases and neither is a failure:
 *
 *  - **Reduced motion.** No translate, no opacity ramp, no animation object at all. The
 *    page turn itself is a state change in `useNativePdfPageState` and still happens —
 *    this only declines to *present* it.
 *  - **No Web Animations API.** A host without `Element.animate` — jsdom, an old
 *    WebView — simply has no presentation, and navigation is unaffected.
 */
export function playNativePdfPageTransition(
  page: HTMLElement,
  direction: NativePdfPageTransitionDirection,
  reducedMotion: boolean
): Animation | null {
  if (reducedMotion) return null
  if (typeof page.animate !== 'function') return null
  return page.animate(nativePdfPageTransitionKeyframes(direction), {
    duration: NATIVE_PAGE_TRANSITION_DURATION_MS,
    easing: NATIVE_PAGE_TRANSITION_EASING,
    // Nothing to fill: the last keyframe *is* the page box's resting style, so the
    // element is already where it should be the moment the animation is dropped.
    fill: 'none'
  })
}
