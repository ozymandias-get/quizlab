// Leaf imports, not the barrel: `index.ts` re-exports this module, so going
// through it would close a cycle inside the primitives folder.
import { cn } from '@shared/lib/uiUtils'

import { motion } from 'motion/react'
import { type ElementType, forwardRef } from 'react'

import { IconButton, type IconButtonSize } from './icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

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
        /* Always `toolbar`. The active surface comes from the unlayered
           `.glass-control-active` rule below; `variant="default"` would paint
           `bg-primary` underneath it, which is a near-white slab in dark mode
           and only survived because the unlayered rule happens to win. */
        variant="toolbar"
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        className={cn(isActive ? activeClassName || 'glass-control-active' : '', className)}
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
