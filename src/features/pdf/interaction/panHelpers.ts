/**
 * DOM helpers for the PDF pan (hand) tool — find the scrollable region the viewer
 * put under the cursor.
 *
 * The viewport selector comes from `../native/nativePdfDom`, the single owner of
 * the native viewer's markup. It used to come from `../lib/pdfViewerDom`, which
 * named `@react-pdf-viewer`'s private inner container; that viewer is gone, and a
 * selector for markup that no longer exists is not a fallback — it is a
 * `querySelector` that can never match, which is why the pan drag silently did
 * nothing on a page that did not overflow.
 */
import { NATIVE_SCROLL_SELECTOR } from '../native/nativePdfDom'

export function isScrollableElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  const oy = style.overflowY
  const ox = style.overflowX
  const canScrollY =
    (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1
  const canScrollX =
    (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && el.scrollWidth > el.clientWidth + 1
  return canScrollY || canScrollX
}

export function getScrollableAncestor(
  start: Element | null,
  rootBoundary: HTMLElement
): HTMLElement | null {
  let el: Element | null = start instanceof Element ? start : null
  while (el && rootBoundary.contains(el)) {
    if (el instanceof HTMLElement && isScrollableElement(el)) {
      return el
    }
    el = el.parentElement
  }
  return null
}

/**
 * The viewer's scrollable viewport, used when no ancestor of the pointer is
 * currently scrollable — a page that fits on screen has no scrollable element to
 * find, and the drag still has to capture the pointer so it does not turn into a
 * text selection.
 */
export function getInnerContainerFallback(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(NATIVE_SCROLL_SELECTOR)
}
