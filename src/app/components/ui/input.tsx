import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

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
        'border-border/80 bg-background/50 placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-normal file:text-ql-12 focus-visible:ring-ring/70 focus-visible:ring-offset-background w-full min-w-0 border px-3.5 transition-[color,box-shadow,border-color] outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2',
        size === 'sm'
          ? 'text-ql-12 h-7 rounded-md px-2.5 py-0.5 shadow-2xs'
          : 'text-ql-14 h-8.5 rounded-lg py-1 shadow-2xs',
        className
      )}
      {...props}
    />
  )
}

export { Input }
