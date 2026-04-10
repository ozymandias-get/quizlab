import { type ElementType, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@ui/components/button'

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
        variant={isActive ? 'default' : 'ghost'}
        size="icon"
        onClick={onClick}
        title={tooltip}
        disabled={disabled}
        className={`
          w-8 h-8 rounded-xl transition-all duration-300
          ${
            isActive
              ? activeClassName || 'bg-white/15 text-white shadow-lg'
              : className || 'text-white/40 hover:text-white hover:bg-white/[0.08]'
          }
        `}
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
