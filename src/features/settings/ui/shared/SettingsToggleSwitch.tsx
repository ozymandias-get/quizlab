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
}

function SettingsToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className
}: SettingsToggleSwitchProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      size={size === 'sm' ? 'sm' : 'default'}
      className={cn(
        checked
          ? 'data-checked:border-emerald-500/30 data-checked:bg-emerald-500/20'
          : 'data-unchecked:border-white/[0.08] data-unchecked:bg-white/[0.04]',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        className
      )}
    />
  )
}

export default memo(SettingsToggleSwitch)
