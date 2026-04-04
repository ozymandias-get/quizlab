import type { MouseEvent } from 'react'

export interface BottomBarProps {
  onHoverChange?: (isHovering: boolean) => void
  onMouseDown?: (e: MouseEvent) => void
}
