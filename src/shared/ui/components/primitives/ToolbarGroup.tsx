import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

export function ToolbarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-muted/40 flex items-center gap-1 rounded-lg p-1.5', className)}
      {...props}
    />
  )
}

export function ToolbarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-border/80 h-4 w-px shrink-0', className)} {...props} />
}
