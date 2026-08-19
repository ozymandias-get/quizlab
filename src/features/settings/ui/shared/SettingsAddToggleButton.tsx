import { Button } from '@app/components/ui/button'

import { Plus, X } from 'lucide-react'
import { memo } from 'react'

interface SettingsAddToggleButtonProps {
  expanded: boolean
  addLabel: string
  cancelLabel: string
  onToggle: () => void
}

function SettingsAddToggleButton({
  expanded,
  addLabel,
  cancelLabel,
  onToggle
}: SettingsAddToggleButtonProps) {
  return (
    <Button
      type="button"
      onClick={onToggle}
      variant={expanded ? 'destructive' : 'outline'}
      size="sm"
      className="gap-1.5"
    >
      {expanded ? (
        <>
          <X className="h-3.5 w-3.5" />
          <span>{cancelLabel}</span>
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" />
          <span>{addLabel}</span>
        </>
      )}
    </Button>
  )
}

export default memo(SettingsAddToggleButton)
