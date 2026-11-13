import { cn } from '@shared/lib/uiUtils'

import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

const kbdVariants = cva(
  'inline-flex items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.06] font-mono font-medium text-zinc-400 shadow-none select-none pointer-events-none transition-colors',
  {
    variants: {
      variant: {
        default: 'text-zinc-400',
        outline: 'border-white/15 bg-zinc-900 text-zinc-300'
      },
      size: {
        xs: 'h-4 min-w-4 px-1 text-ql-10 leading-none rounded-md',
        sm: 'h-5 min-w-5 px-1.5 text-ql-11 leading-none rounded-md',
        default: 'h-5.5 min-w-5.5 px-2 text-ql-12 leading-none rounded-md'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

interface KbdProps extends React.ComponentProps<'kbd'>, VariantProps<typeof kbdVariants> {}

function Kbd({ className, variant, size, ...props }: KbdProps) {
  return (
    <kbd data-slot="kbd" className={cn(kbdVariants({ variant, size, className }))} {...props} />
  )
}

export { Kbd }
