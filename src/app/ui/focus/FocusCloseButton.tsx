import { buttonBaseClass, cn } from '@shared/lib/uiUtils'
import { XIcon } from '@ui/components/Icons'

import { type HTMLMotionProps, motion } from 'motion/react'
import { forwardRef } from 'react'

interface FocusCloseButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  label: string
}

const CLOSE_BUTTON_STYLE = {
  transform: 'translateZ(0)',
  willChange: 'transform'
}

const FocusCloseButton = forwardRef<HTMLButtonElement, FocusCloseButtonProps>(
  ({ label, className, ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          buttonBaseClass,
          'absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg',
          'border-border bg-card/80 border shadow-xs backdrop-blur-md',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          'focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
          'transition-colors duration-150',
          className
        )}
        style={CLOSE_BUTTON_STYLE}
        {...rest}
      >
        <XIcon className="h-4 w-4" />
      </motion.button>
    )
  }
)
FocusCloseButton.displayName = 'FocusCloseButton'

export default FocusCloseButton
