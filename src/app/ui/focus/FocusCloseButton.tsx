import { cn } from '@shared/lib/uiUtils'
import { IconButton } from '@shared/ui/components/primitives'
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
      className="flex shrink-0 items-center"
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
          'border border-white/[0.07] bg-zinc-950/80 shadow-xs backdrop-blur-xl',
          'text-muted-foreground hover:text-foreground hover:bg-white/5',
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
