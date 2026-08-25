import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'

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
        isSelected
          ? 'border-primary/30 bg-primary/[0.06] shadow-xs'
          : 'border-border bg-card hover:bg-muted/50 hover:border-border/80'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-muted/30 group-hover:border-border/80'
        }`}
      >
        {isSelected && <Check className="h-2.5 w-2.5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`text-ql-13 line-clamp-2 leading-snug ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}
        >
          {prompt.text}
        </span>
        {prompt.isDefault && (
          <span className="text-ql-11 text-muted-foreground/60 mt-1 inline-block">
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
            className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 -mt-0.5 -mr-1 opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
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
