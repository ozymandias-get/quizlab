import { IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Check, Trash2 } from 'lucide-react'
import { memo, type MouseEvent } from 'react'

interface PromptItemProps {
  prompt: { id: string; text: string; isDefault?: boolean }
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (e: MouseEvent, id: string) => void
  t: (key: string) => string
}

export const PromptItem = memo(function PromptItem({
  prompt,
  isSelected,
  onSelect,
  onDelete,
  t
}: PromptItemProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={() => onSelect(prompt.id)}
      className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isSelected ? 'border-ring/50 bg-accent/30' : 'border-border/60 bg-card hover:bg-muted/50'
      }`}
    >
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border/60 bg-muted/30 group-hover:border-border'
        }`}
      >
        {isSelected && <Check className="h-2.5 w-2.5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`text-ql-13 line-clamp-2 leading-snug ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          {prompt.text}
        </span>
        {prompt.isDefault && (
          <span className="text-ql-11 text-muted-foreground mt-1 inline-block">
            {t('prompts_ready_badge')}
          </span>
        )}
      </span>

      {!prompt.isDefault && (
        <WithTooltip label={t('delete')}>
          <IconButton
            type="button"
            size="compact"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(e as unknown as MouseEvent, prompt.id)
            }}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive -mt-0.5 -mr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100"
            aria-label={t('delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </WithTooltip>
      )}
    </button>
  )
})
PromptItem.displayName = 'PromptItem'
