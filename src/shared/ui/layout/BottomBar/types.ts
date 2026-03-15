export interface BottomBarProps {
  onHoverChange?: (isHovering: boolean) => void
  isQuizMode: boolean
  onToggleQuizMode: () => void
  onMouseDown?: (e: React.MouseEvent) => void
}
