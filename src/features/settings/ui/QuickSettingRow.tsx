import type { ReactNode } from 'react'
import { memo } from 'react'

interface QuickSettingRowProps {
  icon: ReactNode
  iconColor: string
  iconBorder: string
  title: string
  description: string
  children: ReactNode
}

const QuickSettingRow = memo(function QuickSettingRow({
  icon,
  iconColor,
  iconBorder,
  title,
  description,
  children
}: QuickSettingRowProps) {
  return (
    <div className="border-border bg-card rounded-lg border p-3 transition-colors hover:border-white/[0.1]">
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBorder} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <h4 className="text-xs font-semibold text-white/85">{title}</h4>
            <p className="text-ql-11 leading-relaxed text-white/35">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
})

export default QuickSettingRow
