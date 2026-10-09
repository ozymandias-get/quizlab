import { cn } from '@shared/lib/uiUtils'

import { forwardRef, type HTMLAttributes, memo } from 'react'

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'accent'
  interactive?: boolean
}

/**
 * The plain surface card.
 *
 * This lives here rather than in its own file because it was never part of the
 * shared UI surface: `primitives/index.ts` does not re-export it, and it had
 * exactly one consumer — this file. A module with a single consumer inside the
 * same directory earns nothing from being a separate import.
 */
const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className = '', children, variant = 'default', interactive = false, ...props }, ref) => {
    const variantClasses = {
      default: 'border-border bg-card shadow-xs',
      muted: 'border-border/60 bg-muted/40',
      accent: 'border-ring/30 bg-accent/20'
    }

    const interactiveClasses = interactive
      ? 'cursor-pointer transition-colors motion-normal hover:bg-muted/70 hover:border-border active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
      : ''

    return (
      <div
        ref={ref}
        className={cn('rounded-lg border', variantClasses[variant], interactiveClasses, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

SurfaceCard.displayName = 'SurfaceCard'

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
