import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

export function ToolbarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-white/[0.07] bg-zinc-900/60 p-1.5',
        className
      )}
      {...props}
    />
  )
}

export function ToolbarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('h-4 w-px shrink-0 bg-white/[0.07]', className)} {...props} />
}
