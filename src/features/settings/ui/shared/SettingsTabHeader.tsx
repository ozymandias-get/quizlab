import type { ReactNode } from 'react'
import { memo } from 'react'

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
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
                        {eyebrow}
                    </p>
                    <h4 className="text-sm font-bold tracking-wide text-white/90">
                        {title}
                    </h4>
                </div>
            </div>

            {action}
        </div>
    )
}

export default memo(SettingsTabHeader)
