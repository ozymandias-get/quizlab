import { cn } from '@app/lib/appUtils'

import * as React from 'react'

interface MenuSurfaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  className?: string
  /**
   * ARIA role for the surface. Defaults to `"menu"`; override it when the
   * surface is used as a non-menu popover (e.g. `"dialog"` for a tab list
   * with multiple interactive controls per row) or pass `null` to keep it
   * a plain styled container.
   */
  role?: React.AriaRole | null
}

const MenuSurface = React.forwardRef<HTMLDivElement, MenuSurfaceProps>(function MenuSurface(
  { className, role = 'menu', ...props },
  ref
) {
  return (
    <div
      role={role ?? undefined}
      ref={ref}
      data-slot="menu-surface"
      className={cn(
        'z-dropdown border-border bg-popover text-popover-foreground shadow-ambient-lg rounded-xl border p-1 backdrop-blur-md',
        className
      )}
      {...props}
    />
  )
})

interface MenuItemProps extends React.ComponentProps<'button'> {
  danger?: boolean
  icon?: React.ReactNode
  shortcut?: string
}

function MenuItem({ className, danger, icon, shortcut, children, ...props }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      type="button"
      data-slot="menu-item"
      className={cn(
        'text-ql-12 text-popover-foreground hover:bg-muted focus-visible:ring-ring/40 flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
        danger && 'text-destructive hover:bg-destructive/10',
        className
      )}
      {...props}
    >
      {icon && (
        <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="text-ql-10 text-muted-foreground tracking-ql-caps shrink-0 font-mono uppercase opacity-60">
          {shortcut}
        </span>
      )}
    </button>
  )
}

function MenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="separator" className={cn('bg-border/80 mx-2 my-1 h-px', className)} {...props} />
  )
}

export { MenuItem, MenuSeparator, MenuSurface }
