import { cn } from '@shared/lib/uiUtils'

import { forwardRef, type HTMLAttributes } from 'react'

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'accent'
  interactive?: boolean
}

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className = '', children, variant = 'default', interactive = false, ...props }, ref) => {
    const variantClasses = {
      default: 'border-border bg-card',
      muted: 'border-border/50 bg-muted/30',
      accent: 'border-accent/20 bg-accent/10'
    }

    const interactiveClasses = interactive
      ? 'cursor-pointer transition-all duration-150 hover:bg-accent/50 hover:border-accent/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background'
      : ''

    return (
      <div
        ref={ref}
        className={cn('rounded-xl border', variantClasses[variant], interactiveClasses, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

SurfaceCard.displayName = 'SurfaceCard'
