/**
 * When a document's first page becomes visible.
 *
 * ## Why the render commit, not `status`
 *
 * `useNativePdfDocument` reports `ready` as soon as the page count and the first
 * page's box are known — one to several frames *before* `useNativePdfRender` has
 * painted anything. Starting an entrance on `ready` would therefore fade in the empty
 * canvas the ready branch mounts, and the page would then pop in at full opacity on
 * top of a fade that had already finished. That is exactly the "empty canvas, then the
 * page appears" shape this presentation exists to avoid.
 *
 * `onRenderCommitted` is the one honest signal that real pixels are on screen. It is
 * fired from `useNativePdfRender` in the same task as the canvas blit, so the fade is
 * created before the browser's next style pass and its first frame is already the
 * start of the ramp.
 *
 * ## One entrance per document identity
 *
 * A document identity is `(pdfUrl, reloadKey)`, the same `documentKey` every other
 * layer keys on. The first commit for an identity gets the entrance; every later
 * commit is a page turn (handled by `useNativePdfPageTransition`), a zoom re-render,
 * or a fit-scale render, and none of those may replay it. A reload and a document
 * switch both change the identity, so both earn exactly one new entrance.
 *
 * ## Presentation only
 *
 * No state, no second page, no gate. The animation starts after the commit, is never
 * awaited by a render, and is dropped if the identity changes or the viewer unmounts.
 * Reduced motion and hosts without the Web Animations API get `null` from the
 * presentation call and simply see the page.
 */
import { NATIVE_PAGE_SELECTOR } from '@features/pdf/native/nativePdfDom'
import { playNativePdfDocumentEntrance } from '@features/pdf/native/nativePdfPageTransition'
import { prefersReducedMotion } from '@features/pdf/native/nativePdfReducedMotion'

import { type RefObject, useCallback, useEffect, useRef } from 'react'

interface UseNativePdfDocumentRevealOptions {
  enabled: boolean
  /** Document identity, `(pdfUrl, reloadKey)`. One entrance per value. */
  documentKey: string
  /** The shared viewer container, which holds the page box. */
  containerRef: RefObject<HTMLElement | null>
}

interface NativePdfDocumentRevealHandle {
  /** Report that a render has committed pixels. Fed to `useNativePdfRender`. */
  onRenderCommitted: (pageNumber: number) => void
}

export function useNativePdfDocumentReveal({
  enabled,
  documentKey,
  containerRef
}: UseNativePdfDocumentRevealOptions): NativePdfDocumentRevealHandle {
  /** The identity whose entrance has already been presented. */
  const revealedKeyRef = useRef<string | null>(null)
  const animationRef = useRef<Animation | null>(null)

  const dropAnimation = useCallback(() => {
    animationRef.current?.cancel()
    animationRef.current = null
  }, [])

  const onRenderCommitted = useCallback(() => {
    if (!enabled) return
    if (revealedKeyRef.current === documentKey) return

    const page = containerRef.current?.querySelector<HTMLElement>(NATIVE_PAGE_SELECTOR)
    // A commit with no page box means the viewer is already tearing down. Leave the
    // identity unclaimed so the next mount still earns its entrance.
    if (!page) return

    revealedKeyRef.current = documentKey
    dropAnimation()
    animationRef.current = playNativePdfDocumentEntrance(page, prefersReducedMotion())
  }, [containerRef, documentKey, dropAnimation, enabled])

  // A new identity owns the next entrance; the previous one must not keep running on
  // an element that is about to be replaced.
  useEffect(() => dropAnimation, [documentKey, dropAnimation])

  // A reveal in flight when the viewer goes away must not outlive it.
  useEffect(() => dropAnimation, [dropAnimation])

  return { onRenderCommitted }
}
