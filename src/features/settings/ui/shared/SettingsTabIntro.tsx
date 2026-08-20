import { memo, type ReactNode } from 'react'

interface SettingsTabIntroProps {
  icon: ReactNode
  description?: string
  action?: ReactNode
  hideDescription?: boolean
}

function SettingsTabIntro({
  icon,
  description,
  action,
  hideDescription = false
}: SettingsTabIntroProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {icon}
        {description && !hideDescription && (
          <div className="min-w-0 flex-1 pt-1.5">
            <p className="text-foreground/85 max-w-2xl text-sm leading-relaxed">{description}</p>
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default memo(SettingsTabIntro)
