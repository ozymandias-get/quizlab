import { type ElementType, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@ui/components/button'
import { cn } from '@shared/lib/uiUtils'

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
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        onClick={onClick}
        title={tooltip}
        disabled={disabled}
        className={cn(
          'glass-tier-3 glass-tier-toolbar glass-interactive h-8 w-8 border-white/[0.08] text-white/55 shadow-none transition-all duration-300',
          isActive
            ? activeClassName ||
                'border-white/[0.16] bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] text-white shadow-[0_14px_28px_-20px_rgba(0,0,0,0.72)]'
            : className || 'hover:text-white hover:border-white/[0.14] hover:bg-white/[0.08]',
          disabled && 'opacity-35'
        )}
        asChild
      >
        <motion.button
          whileHover={!disabled ? { scale: 1.08 } : {}}
          whileTap={!disabled ? { scale: 0.95 } : {}}
        >
          <Icon className="w-4 h-4" />
        </motion.button>
      </Button>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'
