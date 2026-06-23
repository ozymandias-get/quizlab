import { memo, type ReactNode } from 'react'

interface SettingsTabHeaderProps {
  icon: ReactNode
  eyebrow: string
  title: string
  action?: ReactNode
}

function SettingsTabHeader({ icon, eyebrow, title, action }: SettingsTabHeaderProps) {
  return (
    <div className="mb-6 flex items-start gap-4">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wider">
          {eyebrow}
        </div>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default memo(SettingsTabHeader)
