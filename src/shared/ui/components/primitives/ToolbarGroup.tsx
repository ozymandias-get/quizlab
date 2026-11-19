import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

/**
 * One group inside a toolbar row: a 1px hairline capsule with a 4px inset, so
 * 28px controls read as one pill. Callers only add layout classes (e.g.
 * `@max-[560px]:hidden`); the surface itself lives here, not at the call site.
 */
export function ToolbarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-white/[0.07] bg-zinc-900/45 p-1',
        className
      )}
      {...props}
    />
  )
}

export function ToolbarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('h-4 w-px shrink-0 bg-white/[0.07]', className)} {...props} />
}
