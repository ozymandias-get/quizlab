import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

function Textarea({
  className,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'size'> & { size?: 'default' | 'sm' }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'bg-background/50 border-border/80 placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-slow focus-visible:ring-ring/70 flex field-sizing-content min-h-16 w-full resize-none rounded-lg border px-2.5 py-2 shadow-2xs transition-[color,box-shadow,border-color] outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2',
        size === 'sm' ? 'text-ql-12' : 'text-ql-14 max-md:text-ql-16',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
