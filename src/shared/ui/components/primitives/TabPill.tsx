import { cn } from '@shared/lib/uiUtils'

import { motion } from 'motion/react'
import * as React from 'react'

export const TAB_PILL_BASE =
  'focus-visible:ring-ring/40 motion-normal relative flex h-8 max-w-[240px] min-w-0 items-center gap-2 rounded-full border px-3 transition-colors outline-none select-none focus-visible:ring-2'

export const TAB_PILL_ACTIVE = 'border-border bg-card text-foreground shadow-xs'
export const TAB_PILL_INACTIVE =
  'text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground border-transparent bg-transparent'

export interface TabPillProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag'
> {
  isActive?: boolean
  /** Right padding override when close/pin buttons are absolute inside. */
  withControls?: boolean
}

export const TabPill = React.forwardRef<HTMLButtonElement, TabPillProps>(function TabPill(
  { className, isActive, withControls, children, ...props },
  ref
) {
  // motion drag props conflict with native onDrag — cast through any to keep HTML button attrs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const motionProps: any = {
    whileTap: { scale: 0.99 }
  }
  return (
    <motion.button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isActive}
      {...motionProps}
      className={cn(
        TAB_PILL_BASE,
        isActive ? TAB_PILL_ACTIVE : TAB_PILL_INACTIVE,
        withControls && 'pr-10',
        className
      )}
      {...props}
    >
      {isActive && (
        <div className="bg-primary/70 pointer-events-none absolute -bottom-px left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full" />
      )}
      {children}
    </motion.button>
  )
})

export function TabPillIcon({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'text-muted-foreground group-hover:text-foreground flex shrink-0 items-center transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5',
        className
      )}
    >
      {children}
    </span>
  )
}

export const TabPillLabel = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { isActive?: boolean }
>(function TabPillLabel({ isActive, className, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn(
        'text-ql-12 min-w-0 truncate font-medium',
        isActive ? 'text-foreground' : 'text-muted-foreground',
        className
      )}
      {...props}
    />
  )
})

// Div variant for drag/rename states where button nesting is not allowed (input inside)
export function TabPillContainer({
  isActive,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { isActive?: boolean }) {
  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={-1}
      className={cn(
        TAB_PILL_BASE,
        isActive ? TAB_PILL_ACTIVE : TAB_PILL_INACTIVE,
        'pr-10',
        className
      )}
      {...props}
    >
      {isActive && (
        <div className="bg-primary/70 pointer-events-none absolute -bottom-px left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full" />
      )}
      {children}
    </div>
  )
}
