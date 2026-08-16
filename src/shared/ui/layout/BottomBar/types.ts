import type { MouseEvent } from 'react'

export interface BottomBarProps {
  onHoverChange?: (isHovering: boolean) => void
  onMouseDown?: (e: MouseEvent) => void
  onDoubleClick?: () => void
  /** Keyboard resize: ArrowLeft/ArrowRight nudge by this pixel delta.
   *  `isReversed` (swapped layout) flips the direction mapping. */
  onKeyboardResize?: (deltaPx: number) => void
  isResizeReversed?: boolean
  /** Hides expensive decorative effects while the panel is being resized. */
  isResizing?: boolean
}
