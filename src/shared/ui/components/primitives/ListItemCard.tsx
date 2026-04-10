import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@shared/lib/uiUtils'

interface ListItemCardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean
  interactive?: boolean
}

export const ListItemCard = forwardRef<HTMLDivElement, ListItemCardProps>(
  ({ className = '', children, active = false, interactive = true, ...props }, ref) => {
    const baseClasses = 'glass-tier-3 rounded-xl p-3'
    const activeClasses = active
      ? 'border-white/[0.16] text-white/90 shadow-[0_14px_28px_-22px_rgba(0,0,0,0.72)]'
      : 'border-white/[0.08] text-white/72'
    const interactiveClasses = interactive
      ? 'glass-interactive cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985]'
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

ListItemCard.displayName = 'ListItemCard'
