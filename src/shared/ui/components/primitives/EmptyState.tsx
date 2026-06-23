import { cn } from '@shared/lib/uiUtils'

import type { ElementType, ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ElementType
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md'
}: EmptyStateProps) => {
  const sizeConfig = {
    sm: { iconSize: 'w-8 h-8', iconInner: 'w-4 h-4', spacing: 'p-5', gap: 'gap-2' },
    md: { iconSize: 'w-10 h-10', iconInner: 'w-5 h-5', spacing: 'p-8', gap: 'gap-3' },
    lg: { iconSize: 'w-12 h-12', iconInner: 'w-6 h-6', spacing: 'p-10', gap: 'gap-4' }
  }[size]

  return (
    <div
      className={cn(
        'border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border border-dashed text-center',
        sizeConfig.spacing,
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            'bg-muted text-muted-foreground mb-3 flex items-center justify-center rounded-xl',
            sizeConfig.iconSize
          )}
        >
          <Icon className={sizeConfig.iconInner} />
        </div>
      )}
      <h3 className="text-foreground mb-1 text-sm font-semibold">{title}</h3>
      {description && (
        <div className="text-muted-foreground mb-4 max-w-sm text-xs leading-relaxed">
          {description}
        </div>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
