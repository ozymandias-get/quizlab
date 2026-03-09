import type { ReactNode } from 'react'
import { memo } from 'react'
import SettingsAddToggleButton from './SettingsAddToggleButton'
import SettingsTabIntro from './SettingsTabIntro'

interface SettingsCollectionTabShellProps {
    icon: ReactNode
    eyebrow: string
    title: string
    showAddForm: boolean
    addLabel: string
    cancelLabel: string
    description: string
    addForm: ReactNode
    list: ReactNode
    footer?: ReactNode
    onToggleAddForm: () => void
}

function SettingsCollectionTabShell({
    icon,
    eyebrow,
    title,
    showAddForm,
    addLabel,
    cancelLabel,
    description,
    addForm,
    list,
    footer,
    onToggleAddForm
}: SettingsCollectionTabShellProps) {
    return (
        <div className="space-y-6 pb-20">
            <SettingsTabIntro
                icon={icon}
                eyebrow={eyebrow}
                title={title}
                description={description}
                hideDescription={showAddForm}
                action={(
                    <SettingsAddToggleButton
                        expanded={showAddForm}
                        addLabel={addLabel}
                        cancelLabel={cancelLabel}
                        onToggle={onToggleAddForm}
                    />
                )}
            />

            {addForm}

            {list}

            {footer}
        </div>
    )
}

export default memo(SettingsCollectionTabShell)
