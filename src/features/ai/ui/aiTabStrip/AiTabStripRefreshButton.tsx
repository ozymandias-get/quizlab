import { RefreshCw } from 'lucide-react'
import { ToolbarButton } from '@shared/ui/components/primitives'

interface AiTabStripRefreshButtonProps {
  disabled?: boolean
  title: string
  onRefresh: () => void
}

function AiTabStripRefreshButton({ disabled, title, onRefresh }: AiTabStripRefreshButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton icon={RefreshCw} disabled={disabled} tooltip={title} onClick={onRefresh} />
    </div>
  )
}

export default AiTabStripRefreshButton
