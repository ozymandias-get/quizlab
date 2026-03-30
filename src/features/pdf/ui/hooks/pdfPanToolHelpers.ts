/**
 * DOM helpers for PDF pan (hand) tool — find scrollable region inside react-pdf-viewer.
 */

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

/**
 * Walk from `start` up to (but not past) `rootBoundary`; return first scrollable ancestor.
 */
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

export function getInnerContainerFallback(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-testid="core__inner-container"]')
}
