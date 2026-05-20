/**
 * Scroll utility for finding the PDF viewer's inner scroll container.
 */
export function getScrollContainer(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  return (
    root.querySelector<HTMLElement>('[data-testid="core__inner-container"]') ||
    root.querySelector<HTMLElement>('.rpv-core__inner-pages')
  )
}
