import { ToolbarButton } from '@shared/ui/components/primitives'

import { Pin } from 'lucide-react'
import { memo } from 'react'

interface AiTabStripPinButtonProps {
  disabled?: boolean
  title: string
  onPin: () => void
}

const AiTabStripPinButton = memo(function AiTabStripPinButton({
  disabled,
  title,
  onPin
}: AiTabStripPinButtonProps) {
  return (
    <div className="shrink-0">
      <ToolbarButton
        icon={Pin}
        disabled={disabled}
        tooltip={title}
        tooltipSide="top"
        tooltipAvoidCollisions={false}
        onClick={onPin}
      />
    </div>
  )
})

export default AiTabStripPinButton
