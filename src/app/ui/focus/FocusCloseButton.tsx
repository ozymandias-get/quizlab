import { IconButton } from '@app/components/ui/icon-button'
import { cn } from '@shared/lib/uiUtils'
import { XIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'

interface FocusCloseButtonProps extends React.ComponentProps<typeof IconButton> {
  label: string
}

const CLOSE_BUTTON_STYLE = {
  transform: 'translateZ(0)',
  willChange: 'transform'
}

const FocusCloseButton = ({ label, className, ...rest }: FocusCloseButtonProps) => {
  return (
    <motion.div
      className="absolute top-4 right-4 z-20"
      style={CLOSE_BUTTON_STYLE}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <IconButton
        type="button"
        size="default"
        variant="outline"
        aria-label={label}
        className={cn(
          'border-border bg-card/80 border shadow-xs backdrop-blur-md',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          className
        )}
        {...rest}
      >
        <XIcon />
      </IconButton>
    </motion.div>
  )
}

export default FocusCloseButton
