import { memo } from 'react'
import { Switch } from '@headlessui/react'
import { cn } from '@shared/lib/uiUtils'

type SettingsToggleSwitchSize = 'sm' | 'md'

interface SettingsToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: SettingsToggleSwitchSize
  className?: string
  knobClassName?: string
}

const TOGGLE_SIZE_CLASSES: Record<
  SettingsToggleSwitchSize,
  { root: string; knob: string; checked: string; unchecked: string }
> = {
  md: {
    root: 'h-6 w-11 p-1',
    knob: 'h-4 w-4 shadow-sm',
    checked: 'translate-x-5',
    unchecked: 'translate-x-0'
  },
  sm: {
    root: 'h-5 w-9 p-0.5',
    knob: 'h-4 w-4',
    checked: 'translate-x-4',
    unchecked: 'translate-x-0'
  }
}

function SettingsToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  knobClassName
}: SettingsToggleSwitchProps) {
  const sizeClasses = TOGGLE_SIZE_CLASSES[size]

  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'relative flex items-center rounded-full border transition-all duration-200 outline-none',
        'focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]',
        sizeClasses.root,
        checked
          ? 'border-emerald-500/30 bg-emerald-500/20 hover:border-emerald-500/45 hover:bg-emerald-500/25'
          : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.14] hover:bg-white/[0.08]',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block transform rounded-full ring-0 transition duration-200 ease-in-out',
          sizeClasses.knob,
          checked
            ? `${sizeClasses.checked} bg-emerald-400`
            : `${sizeClasses.unchecked} bg-white/40`,
          knobClassName
        )}
      />
    </Switch>
  )
}

export default memo(SettingsToggleSwitch)
