import { PANEL_RESIZING_BODY_CLASS } from '@shared/constants/panelResize'

export const DEFAULT_RESIZER_WIDTH = 48
export const WIDTH_CHANGE_THRESHOLD = 0.3

export function setBodyResizingState(isResizing: boolean) {
  if (typeof document === 'undefined') return
  if (isResizing) {
    document.body.classList.add(PANEL_RESIZING_BODY_CLASS)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  } else {
    document.body.classList.remove(PANEL_RESIZING_BODY_CLASS)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

export function calculatePanelBounds(
  windowWidth: number,
  resizerWidth: number,
  minLeft: number,
  minRight: number
) {
  const effectiveResizerWidth = Math.max(28, resizerWidth)
  const maxAvailable = Math.max(0, windowWidth - effectiveResizerWidth)
  const safeMinLeft = Math.min(minLeft, maxAvailable)
  const safeMaxLeft = Math.max(safeMinLeft, windowWidth - minRight - effectiveResizerWidth)
  return { effectiveResizerWidth, safeMinLeft, safeMaxLeft }
}

export function clampPanelPercentage(
  currentPercentage: number,
  windowWidth: number,
  safeMinLeft: number,
  safeMaxLeft: number
): number {
  const desiredWidthPx = (currentPercentage / 100) * windowWidth
  const clampedWidthPx = Math.max(safeMinLeft, Math.min(desiredWidthPx, safeMaxLeft))
  return windowWidth > 0 ? (clampedWidthPx / windowWidth) * 100 : currentPercentage
}
