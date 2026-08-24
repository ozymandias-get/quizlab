import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'bg-background/50 border-border/80 placeholder:text-muted-foreground focus-visible:ring-foreground/15 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-slow flex field-sizing-content min-h-16 w-full resize-none rounded-lg border px-2.5 py-2 text-base shadow-2xs transition-[color,box-shadow,border-color] outline-none focus-visible:border-neutral-400 focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm dark:focus-visible:border-neutral-500',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
