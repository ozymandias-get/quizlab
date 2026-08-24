import { cn } from '@shared/lib/uiUtils'

import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

const kbdVariants = cva(
  'inline-flex items-center justify-center font-mono font-medium select-none pointer-events-none rounded border transition-colors shadow-2xs',
  {
    variants: {
      variant: {
        default: 'border-border/80 bg-muted/80 text-muted-foreground',
        outline: 'border-border bg-background text-foreground/80'
      },
      size: {
        xs: 'h-4 min-w-4 px-1 text-ql-10 leading-none rounded-xs',
        sm: 'h-5 min-w-5 px-1.5 text-ql-11 leading-none rounded-xs',
        default: 'h-5.5 min-w-5.5 px-2 text-ql-12 leading-none rounded-sm'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface KbdProps extends React.ComponentProps<'kbd'>, VariantProps<typeof kbdVariants> {}

function Kbd({ className, variant, size, ...props }: KbdProps) {
  return (
    <kbd data-slot="kbd" className={cn(kbdVariants({ variant, size, className }))} {...props} />
  )
}

export { Kbd, kbdVariants }
