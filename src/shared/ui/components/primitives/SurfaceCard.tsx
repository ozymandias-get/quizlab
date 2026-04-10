import { forwardRef, type HTMLAttributes } from 'react'

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  tier?: 1 | 2 | 3
  interactive?: boolean
}

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className = '', children, tier = 2, interactive = false, ...props }, ref) => {
    const tierClass = `glass-tier-${tier}`
    const interactiveClasses = interactive
      ? 'transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:border-white/10 hover:shadow-lg'
      : ''

    return (
      <div
        ref={ref}
        className={`rounded-2xl p-4 sm:p-5 ${tierClass} ${interactiveClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

SurfaceCard.displayName = 'SurfaceCard'
