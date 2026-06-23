import { Home } from 'lucide-react'

import { ToolbarButton } from './ToolbarButton'

interface TabStripHomeButtonProps {
  isActive?: boolean
  tooltip: string
  onClick?: () => void
  className?: string
}

export function TabStripHomeButton({
  isActive,
  tooltip,
  onClick,
  className
}: TabStripHomeButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton
        icon={Home}
        isActive={isActive}
        tooltip={tooltip}
        onClick={onClick}
        className={className}
      />
    </div>
  )
}
