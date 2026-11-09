import { Switch } from '@app/components/ui/switch'
import { cn } from '@shared/lib/uiUtils'

import { memo } from 'react'

type SettingsToggleSwitchSize = 'sm' | 'md'

interface SettingsToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: SettingsToggleSwitchSize
  className?: string
  /** Lets a <Label htmlFor> name the control, which is what a role="switch" needs. */
  id?: string
  /** Names the control itself when the visible label is the same on every row. */
  'aria-label'?: string
  'aria-describedby'?: string
}

function SettingsToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy
}: SettingsToggleSwitchProps) {
  return (
    <Switch
      id={id}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      size={size === 'sm' ? 'sm' : 'default'}
      className={cn(disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)}
    />
  )
}

export default memo(SettingsToggleSwitch)
