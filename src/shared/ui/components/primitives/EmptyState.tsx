import { cn } from '@shared/lib/uiUtils'

import type { ElementType, ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ElementType
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  bare?: boolean
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
  bare = false
}: EmptyStateProps) => {
  const sizeConfig = {
    sm: { iconSize: 'w-8 h-8', iconInner: 'w-4 h-4', spacing: 'p-5', gap: 'gap-2' },
    md: { iconSize: 'w-10 h-10', iconInner: 'w-5 h-5', spacing: 'p-8', gap: 'gap-3' },
    lg: { iconSize: 'w-12 h-12', iconInner: 'w-6 h-6', spacing: 'p-10', gap: 'gap-4' }
  }[size]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl text-center',
        bare ? '' : 'border border-dashed border-white/[0.07] bg-zinc-900/55',
        sizeConfig.spacing,
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            'mb-3 flex items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-zinc-400',
            sizeConfig.iconSize
          )}
        >
          <Icon className={sizeConfig.iconInner} />
        </div>
      )}
      <h3 className="text-ql-14 mb-1 font-semibold tracking-tight text-zinc-100">{title}</h3>
      {description && (
        <div className="text-ql-12 mb-4 max-w-sm leading-relaxed text-zinc-400">{description}</div>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
