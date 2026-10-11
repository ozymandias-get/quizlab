import { useQuickAiPresets } from '@features/ai'

import { memo } from 'react'

interface PromptPresetsProps {
  onSelect: (preset: string) => void
}

function PromptPresets({ onSelect }: PromptPresetsProps) {
  const { presets } = useQuickAiPresets()

  return (
    <div className="scrollbar-hidden flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
      {presets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onSelect(preset.value)}
          className="border-border/70 bg-background/60 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground focus-visible:ring-ring/40 text-ql-10 motion-normal motion-ok:active:scale-[0.98] flex h-6 shrink-0 items-center rounded-md border px-2 font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none"
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

export default memo(PromptPresets)
