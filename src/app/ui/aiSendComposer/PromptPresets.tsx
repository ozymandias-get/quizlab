import { useQuickAiPresets } from '@features/ai'

import { memo } from 'react'

interface PromptPresetsProps {
  onSelect: (preset: string) => void
}

function PromptPresets({ onSelect }: PromptPresetsProps) {
  const { presets } = useQuickAiPresets()

  return (
    <div className="scrollbar-hidden flex flex-nowrap gap-1.5 overflow-x-auto">
      {presets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onSelect(preset.value)}
          className="text-ql-10 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-foreground/20 rounded-md border px-2 py-0.5 font-medium antialiased transition-colors outline-none focus-visible:ring-1"
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

export default memo(PromptPresets)
