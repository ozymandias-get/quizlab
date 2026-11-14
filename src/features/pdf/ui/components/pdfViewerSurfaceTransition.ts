/**
 * The PDF surface's exit — the one transition the viewer shell owns.
 *
 * ## What this is, and what it is not
 *
 * Closing the last PDF tab used to remove the viewer in the same commit that showed
 * the placeholder: the page vanished, then the placeholder faded in over the gap. This
 * is a 140 ms opacity ramp on the layer that holds `PdfViewerDocument`, so the page
 * (and its toolbar) leaves instead of being cut away, while the placeholder fades in
 * underneath it.
 *
 * It is deliberately **not** a snapshot. Nothing is copied out of the canvas, no second
 * viewer is mounted, and no high-resolution frame is produced: the fading layer is the
 * one that is already on screen.
 *
 * ## Why opacity only, and why on the shell layer
 *
 * `opacity` is compositor-only — no layout, no paint of the page stack, no change to
 * the canvas box. `transform`/`scale` is left out on purpose: scaling a live PDF
 * surface resamples the page and was the source of the "momentary zoom glitch" that got
 * the previous closing animation removed. The shell layer wraps the toolbar and the
 * page as one unit, so the whole surface leaves together and the placeholder is the
 * only thing underneath.
 *
 * ## Why it cannot leave the UI stuck
 *
 * The animation is not a React exit lifecycle: nothing waits on `AnimatePresence`, and
 * no element stays mounted because an exit was scheduled. The caller unmounts the
 * viewer when the animation finishes, when it is cancelled (a rapid reopen), or when
 * this module answers `null`; the shell also arms a short one-shot fallback so a paused
 * or dropped animation can never keep an invisible layer over the placeholder. While
 * the ramp runs, the layer is `pointer-events: none`, so clicks go to the placeholder
 * rather than to a surface that is on its way out.
 *
 * ## Why a loading surface does not animate
 *
 * The live document stays alive for the length of the ramp only because its pixels are
 * already on screen and it is still mounted. It is never *kept* alive to animate: the
 * tab store has already released the blob URL, and PDF.js is not asked for anything
 * new. If the viewer has not painted a page yet — still loading, failed, or closed
 * before the first commit — there is nothing to fade and the viewer is removed
 * immediately. That also keeps a load that rejects after the store revoked its URL from
 * surfacing an error mid-fade.
 *
 * ## Reduced motion
 *
 * `prefers-reduced-motion: reduce` answers `null`, and a `null` animation means "unmount
 * now": no pending exit, no timer, no empty wait. The placeholder is reachable in the
 * same frame, exactly like every other reduced-motion path in this feature.
 */
import { NATIVE_CANVAS_PAGE_ATTRIBUTE } from '@features/pdf/native/nativePdfDom'
import { prefersReducedMotion } from '@features/pdf/native/nativePdfReducedMotion'

import { DURATION } from '@shared/lib/motion'

/**
 * `--duration-normal`, 140 ms — the middle of the requested 120–160 ms band, and the
 * same tempo the toolbar, the menus and a page turn already use.
 */
export const PDF_SURFACE_CLOSE_DURATION_MS = Math.round(DURATION.normal * 1000)

/**
 * How long the shell waits before unmounting on its own if the animation never reports
 * that it finished. One timer, armed once per close, cleared as soon as the animation
 * settles or the close is cancelled — never a chain.
 */
export const PDF_SURFACE_CLOSE_FALLBACK_MS = PDF_SURFACE_CLOSE_DURATION_MS + 80

/** `--ease-glass`, the project's single easing token, in the form WAAPI accepts. */
const PDF_SURFACE_EASING = 'cubic-bezier(0.2, 0.9, 0.22, 1)'

/**
 * Whether this surface may be faded out at all.
 *
 * All four answers have to be yes, and each one prevents a different failure:
 * a mounted layer (there is something to animate), no reduced-motion request (respect
 * the OS setting), the Web Animations API (a host without it closes immediately), and a
 * canvas that has already committed a page (`data-native-pdf-canvas-page` is written
 * back by `useNativePdfRender` only after a blit, and removed while a render is in
 * flight). That last check is what keeps the ramp to a settled page: a loading spinner
 * has nothing to fade, and a page mid-render is better cut than animated from a state
 * nobody can predict.
 */
export function canPresentPdfSurfaceExit(root: HTMLElement | null): root is HTMLElement {
  if (!root) return false
  if (prefersReducedMotion()) return false
  if (typeof root.animate !== 'function') return false
  return root.querySelector(`[${NATIVE_CANVAS_PAGE_ATTRIBUTE}]`) !== null
}

/**
 * Start the exit ramp, or return `null` when the surface should be removed immediately.
 *
 * `fill: 'forwards'` is required here (unlike the page turn and the entrance, whose last
 * keyframe is the resting style): the end state is invisible, and it has to stay
 * invisible between the last animation frame and the unmount commit.
 */
export function playPdfSurfaceExit(root: HTMLElement): Animation | null {
  if (!canPresentPdfSurfaceExit(root)) return null
  return root.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: PDF_SURFACE_CLOSE_DURATION_MS,
    easing: PDF_SURFACE_EASING,
    fill: 'forwards'
  })
}
