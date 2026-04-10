import { Home } from 'lucide-react'
import { ToolbarButton } from './ToolbarButton'

interface TabStripHomeButtonProps {
  isActive?: boolean
  tooltip: string
  onClick?: () => void
}

export function TabStripHomeButton({ isActive, tooltip, onClick }: TabStripHomeButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton icon={Home} isActive={isActive} tooltip={tooltip} onClick={onClick} />
    </div>
  )
}
