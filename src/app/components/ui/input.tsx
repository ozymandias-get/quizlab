import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

/**
 * Text fields are defined by their fill, not by a decorative outline. Focus
 * adds one 2px ring with no offset, so there is never a second (offset) line;
 * invalid fields keep a single destructive border.
 */
const INPUT_FOCUS_RING =
  'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--selection-color-source,oklch(var(--ring)))_60%,transparent)]'

function Input({
  className,
  type,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'input'>, 'size'> & { size?: 'default' | 'sm' }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'placeholder:text-muted-foreground aria-invalid:border-destructive motion-normal file:text-ql-12 w-full min-w-0 border border-transparent bg-white/[0.05] px-3.5 transition-[color,box-shadow,background-color,border-color] outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        INPUT_FOCUS_RING,
        size === 'sm'
          ? 'text-ql-12 h-7 rounded-md px-2.5 py-0.5'
          : 'text-ql-14 h-8.5 rounded-lg py-1',
        className
      )}
      {...props}
    />
  )
}

export { Input }
