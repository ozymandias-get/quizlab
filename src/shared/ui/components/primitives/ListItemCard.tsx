import { cn } from '@shared/lib/uiUtils'

import { forwardRef, type HTMLAttributes, memo } from 'react'

import { SurfaceCard } from './SurfaceCard'

interface ListItemCardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean
  interactive?: boolean
}

const ListItemCardInner = forwardRef<HTMLDivElement, ListItemCardProps>(
  ({ className = '', children, active = false, interactive = true, ...props }, ref) => {
    const activeClasses = active
      ? 'border-ring/60 bg-card text-foreground font-medium'
      : 'text-muted-foreground'

    return (
      <SurfaceCard
        ref={ref}
        interactive={interactive}
        className={cn('flex flex-col gap-2 p-3', activeClasses, className)}
        {...props}
      >
        {children}
      </SurfaceCard>
    )
  }
)

ListItemCardInner.displayName = 'ListItemCardInner'

export const ListItemCard = memo(ListItemCardInner)
