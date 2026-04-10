import { type ReactNode, forwardRef, type HTMLAttributes } from 'react'

interface ActionRowProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  action?: ReactNode
  contentClassName?: string
  actionClassName?: string
}

export const ActionRow = forwardRef<HTMLDivElement, ActionRowProps>(
  (
    { children, action, className = '', contentClassName = '', actionClassName = '', ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between gap-4 w-full ${className}`}
        {...props}
      >
        <div className={`flex items-center gap-3 min-w-0 ${contentClassName}`}>{children}</div>
        {action && (
          <div className={`flex items-center shrink-0 gap-2 ${actionClassName}`}>{action}</div>
        )}
      </div>
    )
  }
)

ActionRow.displayName = 'ActionRow'
