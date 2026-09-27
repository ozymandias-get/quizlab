import { SettingsTabIntro } from '@shared/ui/components/primitives'

import { memo, type ReactNode } from 'react'

import SettingsAddToggleButton from './SettingsAddToggleButton'

interface SettingsCollectionTabShellProps {
  icon: ReactNode
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
    <div className="space-y-6 pb-4">
      <SettingsTabIntro
        icon={icon}
        description={description}
        hideDescription={showAddForm}
        action={
          <SettingsAddToggleButton
            expanded={showAddForm}
            addLabel={addLabel}
            cancelLabel={cancelLabel}
            onToggle={onToggleAddForm}
          />
        }
      />

      {addForm}

      {list}

      {footer}
    </div>
  )
}

export default memo(SettingsCollectionTabShell)
