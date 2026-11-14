import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

/**
 * Same field contract as `Input`: filled surface, no outline at rest, one
 * unoffset focus ring. `aria-invalid` keeps a single destructive border.
 */
const TEXTAREA_FOCUS_RING =
  'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--selection-color-source,oklch(var(--ring)))_60%,transparent)]'

function Textarea({
  className,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'size'> & { size?: 'default' | 'sm' }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-muted-foreground aria-invalid:border-destructive motion-slow flex field-sizing-content min-h-16 w-full resize-none rounded-lg border border-transparent bg-white/[0.05] px-2.5 py-2 transition-[color,box-shadow,background-color,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50',
        TEXTAREA_FOCUS_RING,
        size === 'sm' ? 'text-ql-12' : 'text-ql-14 max-md:text-ql-16',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
