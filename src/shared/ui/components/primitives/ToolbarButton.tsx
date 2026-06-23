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
        whileHover={!disabled ? { scale: 1.08 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        className={cn(
          className,
          'inline-flex shrink-0 items-center justify-center rounded-full border text-sm font-medium whitespace-nowrap transition-all outline-none select-none',
          'focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3',
          'disabled:pointer-events-none disabled:opacity-35',
          'glass-tier-3 glass-interactive h-8 min-h-8 w-8 min-w-8 border-white/[0.08] text-white/55 shadow-none',
          isActive
            ? activeClassName ||
                'border-white/[0.16] bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] text-white shadow-[0_14px_28px_-20px_rgba(0,0,0,0.72)]'
            : 'hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white'
        )}
        aria-label={tooltip}
      >
        <Icon className="h-4 w-4" />
      </motion.button>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'
