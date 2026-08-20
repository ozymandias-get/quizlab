import { cn } from '@shared/lib/uiUtils'

import { forwardRef, type HTMLAttributes } from 'react'

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'accent'
  interactive?: boolean
}

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
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
