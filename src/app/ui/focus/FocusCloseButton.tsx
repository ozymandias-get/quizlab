import { buttonBaseClass, cn } from '@shared/lib/uiUtils'
import { XIcon } from '@ui/components/Icons'

import { type HTMLMotionProps, motion } from 'motion/react'
import { forwardRef } from 'react'

interface FocusCloseButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  label: string
}

const CLOSE_BUTTON_STYLE = {
  width: '2.5rem',
  height: '2.5rem',
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
        whileHover={{
          scale: 1.08,
          rotate: 90,
          transition: { type: 'spring', stiffness: 420, damping: 22, mass: 0.6 }
        }}
        whileTap={{ scale: 0.92, transition: { duration: 0.1 } }}
        className={cn(
          buttonBaseClass,
          'absolute top-4 right-4 z-20 flex items-center justify-center rounded-full',
          'border border-white/15 bg-black/55 backdrop-blur-md',
          'shadow-[0_8px_24px_-8px_oklch(0_0_0/0.6)]',
          'focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none',
          'text-white/80 hover:text-white',
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
