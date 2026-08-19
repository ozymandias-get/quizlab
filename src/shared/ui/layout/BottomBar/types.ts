import type { MouseEvent, PointerEvent } from 'react'

export interface BottomBarProps {
  onHoverChange?: (isHovering: boolean) => void
  /** Legacy mouse handler; prefer the pointer events below. */
  onMouseDown?: (e: MouseEvent) => void
  onPointerDown?: (e: PointerEvent) => void
  onPointerMove?: (e: PointerEvent) => void
  onPointerUp?: (e: PointerEvent) => void
  onLostPointerCapture?: (e: PointerEvent) => void
  onDoubleClick?: () => void
  /** Keyboard resize: ArrowLeft/ArrowRight nudge by this pixel delta.
   *  `isReversed` (swapped layout) flips the direction mapping. */
  onKeyboardResize?: (deltaPx: number) => void
  isResizeReversed?: boolean
  /** Hides expensive decorative effects while the panel is being resized. */
  isResizing?: boolean
}
