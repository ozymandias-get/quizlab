import { type ReactNode, type ElementType } from 'react'

interface EmptyStateProps {
  icon?: ElementType
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-white/[0.05] bg-white/[0.01] ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 mb-4">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-stone-300 font-semibold mb-1">{title}</h3>
      {description && <div className="text-stone-500 text-ql-14 mb-4 max-w-sm">{description}</div>}
      {action && <div>{action}</div>}
    </div>
  )
}
