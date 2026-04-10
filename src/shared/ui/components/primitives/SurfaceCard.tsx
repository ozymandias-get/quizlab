import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@shared/lib/uiUtils'

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  tier?: 1 | 2 | 3
  interactive?: boolean
}

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className = '', children, tier = 2, interactive = false, ...props }, ref) => {
    const tierClass = `glass-tier-${tier}`
    const interactiveClasses = interactive
      ? 'glass-interactive cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985]'
      : ''

    return (
      <div
        ref={ref}
        className={cn('rounded-2xl p-4 sm:p-5', tierClass, interactiveClasses, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

SurfaceCard.displayName = 'SurfaceCard'
