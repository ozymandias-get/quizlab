import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

interface SettingsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant maps to the approved radius/padding matrix. */
  variant?: 'default' | 'accent' | 'muted'
  interactive?: boolean
}

/**
 * Three steps, one direction. The section card is flat (zinc-950/70), so a
 * row can only read as "on" by lifting off it: `default` is the raised control
 * surface used by active/selected rows and matches the hover fill on the AI
 * home cards. `muted` is the idle/passive row, `accent` the explicit selection
 * highlight shared with the home grid cards.
 */
const variantClasses: Record<NonNullable<SettingsRowProps['variant']>, string> = {
  default: 'border-white/[0.07] bg-white/[0.03]',
  muted: 'border-white/[0.06] bg-transparent',
  accent: 'border-ring/35 bg-accent/30'
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
        interactive && 'cursor-pointer transition-colors hover:bg-white/[0.05]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Leading icon tile for a settings row. Same 32px box, hairline and fill as the
 * section header chip, so every leading icon in the modal sits on one scale
 * (32px card/row, 40px page intro, 18px sidebar rail).
 */
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
        'text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]',
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
      className={cn('text-foreground text-ql-13 leading-tight font-semibold', className)}
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
