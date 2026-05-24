import type { ReactNode } from 'react'

export function StatChip({
  accent,
  compact,
  icon,
  label,
  value
}: {
  accent: string
  compact?: boolean
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className={`rounded-lg border border-white/6 bg-white/[0.01] ${compact ? 'flex-1 min-w-[100px] px-2.5 py-2' : 'px-3 py-3'}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex shrink-0 items-center justify-center rounded-md ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
          style={{ color: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className={`truncate font-medium text-white/70 ${compact ? 'text-ql-13' : 'text-ql-14'}`}
          >
            {value}
          </div>
          <div className="text-[10px] text-white/25">{label}</div>
        </div>
      </div>
    </div>
  )
}
