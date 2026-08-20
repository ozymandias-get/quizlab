import { useQuickAiPresets } from '@features/ai'

import { Button } from '@app/components/ui/button'

import { memo } from 'react'

interface PromptPresetsProps {
  onSelect: (preset: string) => void
}

function PromptPresets({ onSelect }: PromptPresetsProps) {
  const { presets } = useQuickAiPresets()

  return (
    <div className="scrollbar-hidden flex flex-nowrap gap-1.5 overflow-x-auto">
      {presets.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onSelect(preset.value)}
          className="text-ql-10 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-foreground/20 rounded-md border font-medium antialiased"
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}

export default memo(PromptPresets)
