/** Minimum distance kept between a floating menu and the viewport edge. */
export const MENU_VIEWPORT_MARGIN = 12

export interface MenuPosition {
  left: number
  top: number
}

/**
 * Keeps a floating menu fully inside the viewport.
 *
 * The caller supplies the pointer position (or preferred anchor) and the
 * menu's measured size. Fixed guesses about menu width/height used to let
 * translated or scaled menus run past the right/bottom edge.
 */
export function fitMenuToViewport(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  margin = MENU_VIEWPORT_MARGIN
): MenuPosition {
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight

  const maxLeft = Math.max(margin, viewportWidth - menuWidth - margin)
  const maxTop = Math.max(margin, viewportHeight - menuHeight - margin)

  return {
    left: Math.max(margin, Math.min(x, maxLeft)),
    top: Math.max(margin, Math.min(y, maxTop))
  }
}
