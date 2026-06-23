import { cn } from '@shared/lib/uiUtils'

import { forwardRef, type HTMLAttributes, memo } from 'react'

interface ListItemCardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean
  interactive?: boolean
}

const ListItemCardInner = forwardRef<HTMLDivElement, ListItemCardProps>(
  ({ className = '', children, active = false, interactive = true, ...props }, ref) => {
    const baseClasses = 'rounded-lg border bg-card p-3'
    const activeClasses = active
      ? 'border-ring/50 text-foreground'
      : 'border-border text-muted-foreground'
    const interactiveClasses = interactive
      ? 'cursor-pointer transition-all duration-150 hover:bg-accent hover:border-accent/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background'
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
