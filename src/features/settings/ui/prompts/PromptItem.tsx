import { IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Check, GripVertical, Pin, Trash2 } from 'lucide-react'
import { memo, type MouseEvent } from 'react'

interface PromptItemProps {
  prompt: { id: string; text: string; isDefault?: boolean }
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (e: MouseEvent, id: string) => void
  /** Moves this custom prompt to the top of the list. */
  onPin?: (id: string) => void
  /** Shows the drag grip used by the reorderable list. */
  draggable?: boolean
  t: (key: string) => string
}

export const PromptItem = memo(function PromptItem({
  prompt,
  isSelected,
  onSelect,
  onDelete,
  onPin,
  draggable = false,
  t
}: PromptItemProps) {
  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(prompt.id)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        onSelect(prompt.id)
      }}
      className={`group focus-visible:ring-ring/70 flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        isSelected ? 'border-ring/50 bg-accent/30' : 'border-border/60 bg-card hover:bg-muted/50'
      }`}
    >
      {draggable && (
        <GripVertical
          aria-hidden
          className="text-muted-foreground/50 group-hover:text-muted-foreground mt-0.5 -ml-1 h-4 w-4 shrink-0 cursor-grab active:cursor-grabbing"
        />
      )}

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

      {!prompt.isDefault && onPin && (
        <WithTooltip label={t('pin_to_top')}>
          <IconButton
            type="button"
            size="compact"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onPin(prompt.id)
            }}
            className="text-muted-foreground hover:text-primary -mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100"
            aria-label={t('pin_to_top')}
          >
            <Pin className="h-3.5 w-3.5" />
          </IconButton>
        </WithTooltip>
      )}

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
    </div>
  )
})
PromptItem.displayName = 'PromptItem'
