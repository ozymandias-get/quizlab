import { cn } from '@shared/lib/uiUtils'

import { forwardRef, type HTMLAttributes, memo } from 'react'

interface ListItemCardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean
  interactive?: boolean
}

const ListItemCardInner = forwardRef<HTMLDivElement, ListItemCardProps>(
  ({ className = '', children, active = false, interactive = true, ...props }, ref) => {
    const baseClasses = 'rounded-lg border bg-card p-3 shadow-xs'
    const activeClasses = active
      ? 'border-ring/60 bg-card text-foreground font-medium'
      : 'border-border text-muted-foreground'
    const interactiveClasses = interactive
      ? 'cursor-pointer transition-colors duration-150 hover:bg-muted/70 hover:border-border active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
      : ''

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          interactiveClasses,
          'flex flex-col gap-2',
          activeClasses,
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ListItemCardInner.displayName = 'ListItemCardInner'

export const ListItemCard = memo(ListItemCardInner)
