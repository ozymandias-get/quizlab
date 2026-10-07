/**
 * The one integration point between page navigation and page-transition presentation.
 *
 * ## `currentPage` stays the single source of truth
 *
 * Every navigation in this viewer — the wheel gesture, the toolbar's arrows, the page
 * number box, an internal PDF link — funnels into `useNativePdfPageState`'s
 * `setCurrentPage`. This hook adds no second page state: no `displayedPage`, no
 * `pendingPage`, no `animatedPage`. It holds two numbers and one direction in refs,
 * none of which React ever renders, and none of which can disagree with `currentPage`
 * because they are only ever compared against it.
 *
 * ## Why the animation starts when the render commits, not when the page changes
 *
 * The architecture renders exactly one page onto exactly one canvas, and the previous
 * page's pixels stay in that canvas until the new render commits. So the question "is the
 * new page on screen yet?" has exactly one honest answer, and it is not `currentPage`:
 *
 *  - Starting on the page change animates the *outgoing* pixels. The reader sees the page
 *    they were on dim and nudge for a few frames while the render they asked for is still
 *    being decoded — a flicker, on a slow render.
 *  - Starting on the render commit animates the *incoming* pixels, in the same task that
 *   painted them and before the next style pass, so the first frame the compositor
 *    shows already carries the entrance. There is no backward flash, because there is no
 *    interval in which the new page was painted at rest.
 *
 * That is the whole of the coordination with the render lifecycle: `useNativePdfRender`
 * reports a committed render, this hook presents it. The render path is never awaited by
 * anything, gains no state, and still supersedes and cancels exactly as it did.
 *
 * ## What counts as a page turn
 *
 * A turn is a change of page identity *after* a render has committed for the current
 * document. That single sentence excludes every case that must not animate:
 *
 *  - **First load.** The first committed render of a document establishes the baseline.
 *    Every page change before it — the resume page, the page count clamping it, the fit
 *    scale's second render — is the load sequence resolving, not the reader turning.
 *  - **Reload and document switch.** Both change the document identity, so both reset the
 *    baseline. A reload that happens to land on a different page is a lifecycle change,
 *    not "previous page".
 *  - **The same page again.** A clamped `setCurrentPage` returns the current value and
 *    React bails out; and a comparison that finds no change produces no direction anyway.
 *
 * ## Rapid navigation: one presentation, latest page wins
 *
 * A direction is *pending*, not queued. Seven wheel ticks or seven toolbar clicks in a row
 * overwrite one ref; the renders they supersede never report a commit, so exactly one
 * animation is created, for the page that actually landed. A turn that arrives while an
 * earlier one is still moving cancels it, so a presentation is never more than 140 ms
 * behind the reader.
 *
 * ## Interaction and geometry during the 140 ms
 *
 * Nothing is locked and nothing is measured:
 *
 *  - The target is the **page box**, so the canvas, the text layer, the annotation layer
 *    and the search overlay move as one unit and cannot drift out of a shared coordinate
 *    system. A link's hitbox moves with the pixels the reader is looking at, which is what
 *    a click has to resolve against.
 *  - No `pointer-events` change: a click during the ramp hits the content where it is
 *    drawn, because hit testing follows the transform.
 *  - Capture is unaffected. No capture path reads this element's box: the page capture
 *    renders from PDF coordinates, the canvas fallback reads the canvas bitmap, and the
 *    area crop is driven by pointer coordinates in the overlay's own viewport. The search
 *    overlay is the one DOM-measuring consumer, and it subtracts the page box's own rect
 *    from the text run's rect, so an ancestor transform cancels out of the subtraction
 *    exactly.
 *
 * ## Layout: a transform cannot disturb the centering
 *
 * `m-auto` on the page box is what centers a short page and keeps a tall page's top edge
 * scrollable, and `transform` is applied after layout — it changes neither the box's
 * margins nor its size, nor the scroll container's overflow, nor whether the scroll
 * origin can reach the start edge. Nothing here reads or writes a geometric property.
 */
import { NATIVE_PAGE_SELECTOR } from '@features/pdf/native/nativePdfDom'
import {
  deriveNativePdfPageTransitionDirection,
  type NativePdfPageTransitionDirection,
  playNativePdfPageTransition
} from '@features/pdf/native/nativePdfPageTransition'
import { prefersReducedMotion } from '@features/pdf/native/nativePdfReducedMotion'

import { type RefObject, useCallback, useEffect, useRef } from 'react'

interface UseNativePdfPageTransitionOptions {
  /** The feature flag. `false` leaves the page box exactly as it was. */
  enabled: boolean
  /** `status === 'ready'`: there is a document, a page box and a baseline to compare to. */
  ready: boolean
  /** Document identity, `(pdfUrl, reloadKey)`. A change is a lifecycle change, not a turn. */
  documentKey: string
  /** The one source of truth, straight from `useNativePdfPageState`. */
  currentPage: number
  /** Page count of the loaded document, used to spot a committed out-of-range page. */
  totalPages: number
  /** The shared viewer container, which holds the single page box. */
  containerRef: RefObject<HTMLElement | null>
}

export interface NativePdfPageTransitionHandle {
  /**
   * Report that a render has committed `pageNumber`'s pixels to the canvas.
   *
   * Handed to `useNativePdfRender`. Deliberately the *only* input: presentation has no way
   * to start, stop or re-time a turn on its own.
   */
  onRenderCommitted: (pageNumber: number) => void
}

export function useNativePdfPageTransition({
  enabled,
  ready,
  documentKey,
  currentPage,
  totalPages,
  containerRef
}: UseNativePdfPageTransitionOptions): NativePdfPageTransitionHandle {
  const documentKeyRef = useRef<string | null>(null)
  /** Last page whose pixels actually reached the canvas for `documentKeyRef`. */
  const committedPageRef = useRef<number | null>(null)
  /** Last page the state machine observed. */
  const seenPageRef = useRef<number | null>(null)
  /** A direction observed but not yet presented, because no render has committed it. */
  const pendingDirectionRef = useRef<NativePdfPageTransitionDirection | null>(null)
  const animationRef = useRef<Animation | null>(null)

  const dropAnimation = useCallback(() => {
    animationRef.current?.cancel()
    animationRef.current = null
  }, [])

  useEffect(() => {
    // No ready document means no page on screen and no baseline, so there is nothing a
    // page change could be compared against. A load, a reload and a document switch all
    // pass through here, and none of them is a turn.
    if (!enabled || !ready) {
      documentKeyRef.current = null
      committedPageRef.current = null
      seenPageRef.current = null
      pendingDirectionRef.current = null
      return
    }

    // First ready frame of a document identity. A reload and a document switch both change
    // `documentKey`, so both land here even though their page numbers are unrelated.
    if (documentKeyRef.current !== documentKey) {
      documentKeyRef.current = documentKey
      committedPageRef.current = null
      seenPageRef.current = currentPage
      pendingDirectionRef.current = null
      return
    }

    const previousPage = seenPageRef.current
    seenPageRef.current = currentPage

    // Nothing has been painted for this identity yet, so a page change here is the load
    // sequence finishing — the resume page, or the page count clamping it. Baseline, not
    // navigation: this is the branch that keeps "open a PDF and land on page 12" silent.
    if (committedPageRef.current === null) return

    if (previousPage === null) return

    // Overwrites rather than queues, so a burst of turns collapses into the newest one.
    pendingDirectionRef.current = deriveNativePdfPageTransitionDirection(previousPage, currentPage)
  }, [currentPage, documentKey, enabled, ready])

  const onRenderCommitted = useCallback(
    (pageNumber: number) => {
      // Only a page the document actually has can establish a baseline. A resume page that
      // was lower-bounded while the page count was unknown can commit a page past the end
      // of the file, and the clamp that follows would otherwise read as a backward turn
      // through a document the reader never turned a page of.
      if (totalPages > 0 && (pageNumber < 1 || pageNumber > totalPages)) return

      committedPageRef.current = pageNumber

      const direction = pendingDirectionRef.current
      if (direction === null) return
      // Consumed: a second commit for the same turn — a zoom re-render, a refit — must not
      // replay it.
      pendingDirectionRef.current = null

      const page = containerRef.current?.querySelector<HTMLElement>(NATIVE_PAGE_SELECTOR)
      if (!page) return

      // A newer turn supersedes whatever is still moving.
      dropAnimation()
      animationRef.current = playNativePdfPageTransition(page, direction, prefersReducedMotion())
    },
    [containerRef, dropAnimation, totalPages]
  )

  // A turn in flight when the viewer goes away must not outlive it.
  useEffect(() => dropAnimation, [dropAnimation])

  return { onRenderCommitted }
}
