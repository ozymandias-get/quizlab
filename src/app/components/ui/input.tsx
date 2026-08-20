import { cn } from '@app/lib/appUtils'

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
        'border-border/80 bg-background/50 placeholder:text-muted-foreground focus-visible:ring-foreground/15 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-normal w-full min-w-0 border px-2.5 transition-[color,box-shadow,border-color] outline-none file:inline-flex file:border-0 file:bg-transparent file:text-xs file:font-medium focus-visible:border-neutral-400 focus-visible:ring-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 dark:focus-visible:border-neutral-500',
        size === 'sm'
          ? 'h-7 rounded-md py-0.5 text-xs shadow-2xs'
          : 'h-8 rounded-lg py-1 text-sm shadow-2xs',
        className
      )}
      {...props}
    />
  )
}

export { Input }
