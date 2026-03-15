import { memo } from 'react'
import { PlusIcon } from '@ui/components/Icons'

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
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-300 ${
        expanded
          ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
      }`}
    >
      {expanded ? (
        <span className="text-xs font-bold">{cancelLabel}</span>
      ) : (
        <>
          <PlusIcon className="w-4 h-4" />
          <span className="text-xs font-bold">{addLabel}</span>
        </>
      )}
    </button>
  )
}

export default memo(SettingsAddToggleButton)
