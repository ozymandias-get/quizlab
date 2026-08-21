import { cn } from '@app/lib/appUtils'

import * as React from 'react'

export function PanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border bg-card/80 flex shrink-0 items-center justify-between border-b px-5 py-3.5',
        className
      )}
      {...props}
    />
  )
}

export function PanelHeaderIcon({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'border-primary/20 bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg border shadow-xs',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PanelHeaderTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-ql-13 text-foreground font-semibold', className)} {...props} />
}

export function PanelHeaderSubtitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-ql-11 text-muted-foreground', className)} {...props} />
}
