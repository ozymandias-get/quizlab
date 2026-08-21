import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

export interface SettingsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant maps to the approved radius/padding matrix. */
  variant?: 'default' | 'accent' | 'muted'
  interactive?: boolean
}

const variantClasses: Record<NonNullable<SettingsRowProps['variant']>, string> = {
  default: 'border-border bg-card shadow-xs',
  muted: 'border-border/60 bg-muted/40',
  accent: 'border-ring/30 bg-accent/20'
}

export function SettingsRow({
  className,
  variant = 'default',
  interactive,
  children,
  ...props
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        variantClasses[variant],
        interactive && 'hover:bg-muted/60 hover:border-border cursor-pointer transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SettingsRowIcon({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'border-primary/20 bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
        className
      )}
    >
      {children}
    </div>
  )
}

export function SettingsRowHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 grow', className)} {...props} />
}

export function SettingsRowTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn('text-foreground text-ql-12 leading-tight font-semibold', className)}
      {...props}
    />
  )
}

export function SettingsRowDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-muted-foreground text-ql-12 mt-0.5 leading-relaxed', className)}
      {...props}
    />
  )
}
