import { IconButton, type IconButtonSize } from '@app/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
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
  /** Control size contract: `compact` = 28px (dense toolbars), `default` = 32px. */
  size?: IconButtonSize
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
      disabled = false,
      size = 'default'
    },
    ref
  ) => {
    const content = (
      <IconButton
        asChild
        ref={ref}
        type="button"
        size={size}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        className={cn(
          'glass-tier-3 glass-tier-3-dim glass-interactive glass-tier-control text-muted-foreground glass-control-hover',
          isActive ? activeClassName || 'glass-control-active' : '',
          className
        )}
      >
        <motion.button
          type="button"
          whileHover={!disabled ? { scale: 1.02 } : {}}
          whileTap={!disabled ? { scale: 0.98 } : {}}
        >
          <Icon />
        </motion.button>
      </IconButton>
    )

    if (!tooltip) return content

    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'
