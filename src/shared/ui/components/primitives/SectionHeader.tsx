import { type ReactNode } from 'react'

interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  titleClassName?: string
}

export const SectionHeader = ({
  title,
  description,
  actions,
  icon,
  className = '',
  titleClassName = ''
}: SectionHeaderProps) => {
  return (
    <div className={`flex items-start justify-between gap-4 w-full ${className}`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icon && <div className="shrink-0 mt-1">{icon}</div>}
        <div className="flex flex-col min-w-0">
          <h2
            className={`text-ql-20 font-bold text-white tracking-tight truncate ${titleClassName}`}
          >
            {title}
          </h2>
          {description && <p className="text-ql-14 text-stone-400 mt-1">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
