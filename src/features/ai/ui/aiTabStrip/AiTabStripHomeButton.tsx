import { Home } from 'lucide-react'
import { ToolbarButton } from '@shared/ui/components/primitives'

interface AiTabStripHomeButtonProps {
  showHome?: boolean
  title: string
  onShowHome?: () => void
}

function AiTabStripHomeButton({ showHome, title, onShowHome }: AiTabStripHomeButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton icon={Home} isActive={showHome} tooltip={title} onClick={onShowHome} />
    </div>
  )
}

export default AiTabStripHomeButton
