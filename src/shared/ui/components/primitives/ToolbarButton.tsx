import { cn } from '@shared/lib/uiUtils'

import { motion } from 'motion/react'
import { type ElementType, forwardRef } from 'react'

interface ToolbarButtonProps {
  onClick?: () => void
  icon: ElementType
  tooltip?: string
  isActive?: boolean
  className?: string
  activeClassName?: string
  disabled?: boolean
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      onClick,
      icon: Icon,
      tooltip,
      isActive = false,
      className,
      activeClassName,
      disabled = false
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        title={tooltip}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.02 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        className={cn(
          'glass-tier-3 glass-interactive inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium whitespace-nowrap transition-colors outline-none select-none',
          'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2',
          'disabled:pointer-events-none disabled:opacity-40',
          'border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
          isActive ? activeClassName || 'border-ring/50 bg-accent text-foreground shadow-sm' : '',
          className
        )}
        aria-label={tooltip}
      >
        <Icon className="h-4 w-4" />
      </motion.button>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'
