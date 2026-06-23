import { PlusIcon } from '@ui/components/Icons'

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
    <button
      type="button"
      onClick={onToggle}
      className={`text-ql-11 flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold transition-colors duration-300 ${
        expanded
          ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
      }`}
    >
      {expanded ? (
        <span>{cancelLabel}</span>
      ) : (
        <>
          <PlusIcon className="h-4 w-4" />
          <span>{addLabel}</span>
        </>
      )}
    </button>
  )
}

export default memo(SettingsAddToggleButton)
