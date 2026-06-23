import { ToolbarButton } from '@shared/ui/components/primitives'

import { RefreshCw } from 'lucide-react'
import { memo } from 'react'

interface AiTabStripRefreshButtonProps {
  disabled?: boolean
  title: string
  onRefresh: () => void
}

const AiTabStripRefreshButton = memo(function AiTabStripRefreshButton({
  disabled,
  title,
  onRefresh
}: AiTabStripRefreshButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton icon={RefreshCw} disabled={disabled} tooltip={title} onClick={onRefresh} />
    </div>
  )
})

export default AiTabStripRefreshButton
