import { memo, type ReactNode } from 'react'

interface SettingsTabHeaderProps {
  icon: ReactNode
  eyebrow: string
  title: string
  action?: ReactNode
}

function SettingsTabHeader({ icon, eyebrow, title, action }: SettingsTabHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <div className="flex items-center gap-3">
        {icon}
        <div className="space-y-0.5">
          <p className="text-ql-11 font-medium tracking-ql-fine text-white/38">{eyebrow}</p>
          <h4 className="text-ql-16 font-semibold tracking-tight text-white/90">{title}</h4>
        </div>
      </div>

      {action}
    </div>
  )
}

export default memo(SettingsTabHeader)
