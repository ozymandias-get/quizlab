import type { ReactNode } from 'react'
import { memo } from 'react'

interface QuickSettingRowProps {
  icon: ReactNode
  iconColor?: string
  iconBorder?: string
  title: string
  description: string
  children: ReactNode
}

const QuickSettingRow = memo(function QuickSettingRow({
  icon,
  iconColor = 'text-primary',
  iconBorder = 'border-primary/20 bg-primary/10',
  title,
  description,
  children
}: QuickSettingRowProps) {
  return (
    <div className="border-border bg-card hover:border-border/80 rounded-lg border p-3.5 shadow-xs transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBorder} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h4 className="text-foreground text-xs font-semibold">{title}</h4>
            <p className="text-ql-11 text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
})

export default QuickSettingRow
