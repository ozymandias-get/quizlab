import { forwardRef, type HTMLAttributes } from 'react'

interface ListItemCardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean
  interactive?: boolean
}

export const ListItemCard = forwardRef<HTMLDivElement, ListItemCardProps>(
  ({ className = '', children, active = false, interactive = true, ...props }, ref) => {
    const baseClasses = 'glass-tier-3 rounded-xl p-3'
    const activeClasses = active
      ? 'bg-white/10 border-white/20 shadow-sm'
      : 'hover:bg-white/[0.04] border-transparent hover:border-white/[0.08]'
    const interactiveClasses = interactive
      ? 'cursor-pointer transition-all duration-200 active:scale-[0.98]'
      : ''

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${interactiveClasses} flex flex-col gap-2 ${activeClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ListItemCard.displayName = 'ListItemCard'
