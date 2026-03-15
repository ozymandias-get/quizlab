import type { ReactNode } from 'react'
import { memo } from 'react'
import SettingsTabHeader from './SettingsTabHeader'

interface SettingsTabIntroProps {
  icon: ReactNode
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  hideDescription?: boolean
}

function SettingsTabIntro({
  icon,
  eyebrow,
  title,
  description,
  action,
  hideDescription = false
}: SettingsTabIntroProps) {
  return (
    <>
      <SettingsTabHeader icon={icon} eyebrow={eyebrow} title={title} action={action} />

      {description && !hideDescription && (
        <div className="px-1">
          <p className="text-xs leading-relaxed text-white/40">{description}</p>
        </div>
      )}
    </>
  )
}

export default memo(SettingsTabIntro)
