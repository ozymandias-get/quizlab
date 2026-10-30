import { Home } from 'lucide-react'

import { ToolbarButton } from './ToolbarButton'

interface TabStripHomeButtonProps {
  isActive?: boolean
  tooltip: string
  onClick?: () => void
  className?: string
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  tooltipAvoidCollisions?: boolean
}

export function TabStripHomeButton({
  isActive,
  tooltip,
  onClick,
  className,
  tooltipSide = 'top',
  tooltipAvoidCollisions = false
}: TabStripHomeButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton
        icon={Home}
        isActive={isActive}
        tooltip={tooltip}
        tooltipSide={tooltipSide}
        tooltipAvoidCollisions={tooltipAvoidCollisions}
        onClick={onClick}
        className={className}
      />
    </div>
  )
}
