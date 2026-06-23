import type { MouseEvent } from 'react'

export interface BottomBarProps {
  onHoverChange?: (isHovering: boolean) => void
  onMouseDown?: (e: MouseEvent) => void
  onDoubleClick?: () => void
  /** Hides expensive decorative effects while the panel is being resized. */
  isResizing?: boolean
}
