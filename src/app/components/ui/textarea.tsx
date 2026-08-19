import { cn } from '@app/lib/appUtils'

import * as React from 'react'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'bg-input/50 border-border/80 placeholder:text-muted-foreground focus-visible:ring-foreground/15 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-16 w-full resize-none rounded-xl border px-2.5 py-2 text-base transition-[color,box-shadow,border-color] duration-200 outline-none focus-visible:border-neutral-400 focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm dark:focus-visible:border-neutral-500',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
