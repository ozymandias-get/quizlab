import { cn } from '@shared/lib/uiUtils'

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
        'z-dropdown rounded-xl border border-white/12 bg-zinc-950/95 p-1 text-zinc-100 shadow-2xl backdrop-blur-xl',
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
        'text-ql-12 focus-visible:ring-ring/70 flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        danger && 'text-red-400 hover:bg-red-500/10',
        className
      )}
      {...props}
    >
      {icon && (
        <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && (
        <kbd className="text-ql-10 shrink-0 rounded border border-white/[0.07] bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

function MenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="separator" className={cn('mx-1.5 my-1 h-px bg-white/10', className)} {...props} />
  )
}

export { MenuItem, MenuSeparator, MenuSurface }
